#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
. "$SCRIPT_DIR/ssh-auth.sh"

ARCHIVE="${1:?Usage: deploy-production.sh RELEASE_ARCHIVE}"
RELEASE_ID="${RELEASE_ID:-$(date +%Y%m%d-%H%M%S)}"
REMOTE_ARCHIVE="/tmp/loteria-${RELEASE_ID}.tar.gz"

echo "Creating production backups: ${RELEASE_ID}"
remote_ssh "set -eu; BACKUP=/var/backups/loteria/${RELEASE_ID}; mkdir -p \"\$BACKUP\"; sudo -u postgres pg_dump -Fc loteria > \"\$BACKUP/loteria.dump\"; cd /var/www/loteria/server; tar -czf \"\$BACKUP/server-source.tar.gz\" --exclude=node_modules --exclude=.next --exclude='public/apk' --exclude='public/downloads' src prisma scripts public package.json package-lock.json next.config.ts prisma.config.ts tsconfig.json watchdog.js .env; chmod 600 \"\$BACKUP/loteria.dump\" \"\$BACKUP/server-source.tar.gz\"; ls -lh \"\$BACKUP\""

echo "Uploading release archive"
remote_scp "$ARCHIVE" "${LOTERIA_HOST}:${REMOTE_ARCHIVE}"

echo "Installing, migrating and building release"
remote_ssh "set -eu; cd /var/www/loteria/server; tar -xzf '${REMOTE_ARCHIVE}'; rm -f '${REMOTE_ARCHIVE}'; if ! grep -q '^JWT_SECRET=' .env; then printf '\nJWT_SECRET=%s\n' \"\$(openssl rand -hex 32)\" >> .env; fi; chmod 600 .env; npm ci; npx prisma generate; npx prisma migrate deploy; NODE_ENV=production npm run build; pm2 restart loteria-tv --update-env; pm2 save"

echo "Running smoke tests"
remote_ssh "set -eu; sleep 3; curl -fsS http://127.0.0.1:3008/login >/dev/null; curl -fsS http://127.0.0.1:3008/api/manifest >/dev/null; curl -fsS https://loteriarn.patagonialive.media/api/manifest >/dev/null; pm2 describe loteria-tv | grep -E 'status|uptime|restarts'"

echo "Release ${RELEASE_ID} deployed successfully"
