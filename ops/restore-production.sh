#!/bin/sh
set -eu
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
. "$SCRIPT_DIR/ssh-auth.sh"
BACKUP="${1:?Usage: restore-production.sh BACKUP.tar.gz}"
: "${CONFIRM_RESTORE:?Set CONFIRM_RESTORE=RESTORE_LOTERIA}"
[ "$CONFIRM_RESTORE" = "RESTORE_LOTERIA" ] || { echo "Invalid confirmation" >&2; exit 1; }

REMOTE_FILE="/tmp/loteria-restore.tar.gz"
remote_scp "$BACKUP" "$LOTERIA_HOST:$REMOTE_FILE"
remote_ssh <<'REMOTE'
set -eu
WORK=$(mktemp -d /tmp/loteria-restore.XXXXXX)
tar -xzf /tmp/loteria-restore.tar.gz -C "$WORK"
cd "$WORK"
sha256sum -c SHA256SUMS
pm2 stop loteria-tv loteria-watchdog || true
mkdir -p /var/www/loteria/server /var/www/loteria/storage
tar -xzf server.tar.gz -C /var/www/loteria/server
tar -xzf media.tar.gz -C /var/www/loteria/storage
sudo -u postgres dropdb --if-exists loteria_restore_check
sudo -u postgres createdb loteria_restore_check
sudo -u postgres pg_restore --exit-on-error --no-owner -d loteria_restore_check database.dump
sudo -u postgres dropdb loteria_restore_check
sudo -u postgres dropdb --if-exists loteria
sudo -u postgres createdb -O loteria_app loteria
sudo -u postgres pg_restore --exit-on-error --no-owner -d loteria database.dump
cd /var/www/loteria/server
npm ci
npx prisma generate
npx prisma migrate deploy
NODE_ENV=production npm run build
pm2 restart loteria-tv --update-env
pm2 restart loteria-watchdog --update-env
pm2 save
sleep 3
curl -fsS http://127.0.0.1:3008/login >/dev/null
curl -fsS http://127.0.0.1:3008/api/manifest >/dev/null
rm -rf "$WORK" /tmp/loteria-restore.tar.gz
echo "Restore completed and smoke-tested"
REMOTE
