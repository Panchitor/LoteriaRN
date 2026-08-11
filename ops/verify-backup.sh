#!/bin/sh
set -eu
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
. "$SCRIPT_DIR/ssh-auth.sh"
BACKUP="${1:?Usage: verify-backup.sh BACKUP.tar.gz}"
REMOTE_FILE="/tmp/loteria-verify-backup.tar.gz"

remote_scp "$BACKUP" "$LOTERIA_HOST:$REMOTE_FILE"
remote_ssh <<'REMOTE'
set -eu
WORK=$(mktemp -d /tmp/loteria-verify.XXXXXX)
cleanup() {
  sudo -u postgres dropdb --if-exists loteria_restore_check >/dev/null 2>&1 || true
  rm -rf "$WORK" /tmp/loteria-verify-backup.tar.gz
}
trap cleanup EXIT INT TERM
tar -xzf /tmp/loteria-verify-backup.tar.gz -C "$WORK"
cd "$WORK"
sha256sum -c SHA256SUMS
sudo -u postgres dropdb --if-exists loteria_restore_check
sudo -u postgres createdb loteria_restore_check
sudo -u postgres pg_restore --exit-on-error --no-owner -d loteria_restore_check database.dump
TABLES=$(sudo -u postgres psql -Atd loteria_restore_check -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")
DEVICES=$(sudo -u postgres psql -Atd loteria_restore_check -c 'SELECT count(*) FROM "Device"')
[ "$TABLES" -gt 0 ]
echo "Backup verified: tables=$TABLES devices=$DEVICES"
REMOTE
