#!/bin/sh
set -eu
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
. "$SCRIPT_DIR/ssh-auth.sh"

VERSION="${1:?Usage: publish-apk.sh VERSION APK_FILE}"
APK_FILE="${2:?Usage: publish-apk.sh VERSION APK_FILE}"
case "$VERSION" in
  *[!0-9A-Za-z.+-]*|'') echo "Invalid version: $VERSION" >&2; exit 2 ;;
esac
[ -f "$APK_FILE" ] || { echo "APK not found: $APK_FILE" >&2; exit 2; }
REMOTE_NAME="loteria-tv-v$(printf '%s' "$VERSION" | tr . _).apk"
REMOTE_PATH="/var/www/loteria/server/public/apk/${REMOTE_NAME}"
PUBLIC_URL="https://loteriarn.patagonialive.media/apk/${REMOTE_NAME}"

remote_ssh "mkdir -p /var/www/loteria/server/public/apk"
remote_scp "$APK_FILE" "${LOTERIA_HOST}:${REMOTE_PATH}"
remote_ssh "set -eu; APK_SHA256=\$(sha256sum '${REMOTE_PATH}' | awk '{print \$1}'); printf 'SHA-256: %s\\n' \"\$APK_SHA256\"; sudo -u postgres psql -v ON_ERROR_STOP=1 -v apk_sha256=\"\$APK_SHA256\" -d loteria <<SQL
BEGIN;
INSERT INTO \"SystemConfig\" (key, value, updated_at) VALUES ('LATEST_APK_VERSION', '${VERSION}', NOW()) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW();
INSERT INTO \"SystemConfig\" (key, value, updated_at) VALUES ('LATEST_APK_URL', '${PUBLIC_URL}', NOW()) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW();
INSERT INTO \"SystemConfig\" (key, value, updated_at) VALUES ('LATEST_APK_SHA256', :'apk_sha256', NOW()) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW();
COMMIT;
SQL
curl -fsSI '${PUBLIC_URL}' | head -n 1"

echo "Published APK ${VERSION}: ${PUBLIC_URL}"
