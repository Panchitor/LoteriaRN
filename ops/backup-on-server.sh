#!/bin/sh
set -eu

BACKUP_ROOT="${BACKUP_ROOT:-/var/backups/loteria/automatic}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
STAMP="$(date +%Y%m%d-%H%M%S)"
WORK="$(mktemp -d /tmp/loteria-auto-backup.XXXXXX)"
ARCHIVE="$BACKUP_ROOT/loteria-daily-$STAMP.tar.gz"

cleanup() { rm -rf "$WORK"; }
trap cleanup EXIT INT TERM
mkdir -p "$BACKUP_ROOT"

sudo -u postgres pg_dump -Fc loteria > "$WORK/database.dump"
tar -czf "$WORK/server-source.tar.gz" -C /var/www/loteria/server \
  --exclude=node_modules --exclude=.next --exclude=postgres-data \
  --exclude=public/apk --exclude=public/downloads .
tar -czf "$WORK/media.tar.gz" -C /var/www/loteria/storage videos
cp /var/www/loteria/server/.env "$WORK/server.env"
cp /etc/nginx/sites-enabled/loteria* "$WORK/" 2>/dev/null || true
cp /root/.pm2/dump.pm2 "$WORK/pm2.dump"
chmod 600 "$WORK/server.env"
(cd "$WORK" && sha256sum ./* > SHA256SUMS)
tar -czf "$ARCHIVE" -C "$WORK" .
chmod 600 "$ARCHIVE"

# Validate the archive before considering the backup successful.
VERIFY="$(mktemp -d /tmp/loteria-auto-verify.XXXXXX)"
tar -xzf "$ARCHIVE" -C "$VERIFY"
(cd "$VERIFY" && sha256sum -c SHA256SUMS >/dev/null)
rm -rf "$VERIFY"

find "$BACKUP_ROOT" -type f -name 'loteria-daily-*.tar.gz' -mtime "+$RETENTION_DAYS" -delete
echo "Automatic backup verified: $ARCHIVE"
