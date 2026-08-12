#!/bin/sh
set -eu
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
. "$SCRIPT_DIR/ssh-auth.sh"

DESTINATION="${1:-./backups}"
STAMP="$(date +%Y%m%d-%H%M%S)"
REMOTE_FILE="/tmp/loteria-full-$STAMP.tar.gz"
mkdir -p "$DESTINATION"

remote_ssh "set -eu
WORK=/tmp/loteria-backup-$STAMP
mkdir -p \"\$WORK\"
sudo -u postgres pg_dump -Fc loteria > \"\$WORK/database.dump\"
tar -czf \"\$WORK/server.tar.gz\" -C /var/www/loteria/server --exclude=node_modules --exclude=.next --exclude=public/downloads .
tar -czf \"\$WORK/media.tar.gz\" -C /var/www/loteria/storage videos
cp /etc/nginx/sites-enabled/loteria* \"\$WORK/\" 2>/dev/null || true
pm2 save
cp /root/.pm2/dump.pm2 \"\$WORK/pm2.dump\"
(cd \"\$WORK\" && sha256sum ./* > SHA256SUMS)
tar -czf '$REMOTE_FILE' -C \"\$WORK\" .
rm -rf \"\$WORK\"
chmod 600 '$REMOTE_FILE'"
remote_scp "$LOTERIA_HOST:$REMOTE_FILE" "$DESTINATION/"
remote_ssh "rm -f '$REMOTE_FILE'"
sha256sum "$DESTINATION/loteria-full-$STAMP.tar.gz" > "$DESTINATION/loteria-full-$STAMP.tar.gz.sha256"
echo "Backup created: $DESTINATION/loteria-full-$STAMP.tar.gz"
