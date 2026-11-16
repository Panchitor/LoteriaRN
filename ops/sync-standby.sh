#!/bin/sh
set -eu

# Run on the primary server. Required variables are loaded by systemd from
# /etc/loteria/standby-sync.env (see docs/FAILOVER.md).
: "${STANDBY_HOST:?STANDBY_HOST is required (for example root@backup-host)}"
STANDBY_PORT="${STANDBY_PORT:-22}"
STANDBY_KEY="${STANDBY_KEY:-/root/.ssh/loteria_standby_ed25519}"
PRIMARY_DB="${PRIMARY_DB:-loteria}"
STANDBY_APP="${STANDBY_APP:-loteria-tv}"
REMOTE_ROOT="${REMOTE_ROOT:-/var/www/loteria}"

LOCK=/run/lock/loteria-standby-sync.lock
WORK="$(mktemp -d /tmp/loteria-standby-sync.XXXXXX)"
cleanup() { rm -rf "$WORK"; }
trap cleanup EXIT INT TERM

exec 9>"$LOCK"
flock -n 9 || exit 0

SSH="ssh -i $STANDBY_KEY -o BatchMode=yes -o StrictHostKeyChecking=accept-new -p $STANDBY_PORT"
RSYNC_SSH="ssh -i $STANDBY_KEY -o BatchMode=yes -o StrictHostKeyChecking=accept-new -p $STANDBY_PORT"

$SSH "$STANDBY_HOST" "grep -q '^SERVER_MODE=STANDBY_READONLY$' '$REMOTE_ROOT/server/.env'" || {
  echo 'Refusing sync: target is not configured as STANDBY_READONLY' >&2
  exit 1
}

echo "[$(date -Is)] Synchronizing standby media"
rsync -az --delete -e "$RSYNC_SSH" /var/www/loteria/storage/ "$STANDBY_HOST:$REMOTE_ROOT/storage/"
if [ -d /var/www/loteria/server/public/apk ]; then
  rsync -az --delete -e "$RSYNC_SSH" /var/www/loteria/server/public/apk/ "$STANDBY_HOST:$REMOTE_ROOT/server/public/apk/"
fi

echo "[$(date -Is)] Creating consistent database snapshot"
sudo -u postgres pg_dump -Fc "$PRIMARY_DB" > "$WORK/database.dump"
(cd "$WORK" && sha256sum database.dump > database.dump.sha256)
scp -i "$STANDBY_KEY" -o BatchMode=yes -o StrictHostKeyChecking=accept-new -P "$STANDBY_PORT" \
  "$WORK/database.dump" "$WORK/database.dump.sha256" "$STANDBY_HOST:/tmp/"

echo "[$(date -Is)] Validating and atomically replacing standby database"
$SSH "$STANDBY_HOST" "REMOTE_ROOT='$REMOTE_ROOT' STANDBY_APP='$STANDBY_APP' sh -s" <<'REMOTE'
set -eu
cd /tmp
sha256sum -c database.dump.sha256
grep -q '^SERVER_MODE=STANDBY_READONLY$' "$REMOTE_ROOT/server/.env" || {
  echo 'Refusing sync: standby SERVER_MODE is not STANDBY_READONLY' >&2
  exit 1
}

sudo -u postgres dropdb --if-exists loteria_sync_next
sudo -u postgres createdb --owner=loteria_app loteria_sync_next
sudo -u postgres pg_restore --no-owner --role=loteria_app --dbname=loteria_sync_next database.dump

pm2 stop "$STANDBY_APP" >/dev/null || true
sudo -u postgres psql -v ON_ERROR_STOP=1 -d postgres <<'SQL'
SELECT pg_terminate_backend(pid) FROM pg_stat_activity
WHERE datname IN ('loteria', 'loteria_standby_previous') AND pid <> pg_backend_pid();
DROP DATABASE IF EXISTS loteria_standby_previous;
ALTER DATABASE loteria RENAME TO loteria_standby_previous;
ALTER DATABASE loteria_sync_next RENAME TO loteria;
SQL
pm2 restart "$STANDBY_APP" --update-env >/dev/null || pm2 start "$STANDBY_APP" >/dev/null
rm -f /tmp/database.dump /tmp/database.dump.sha256
sleep 2
curl -fsS http://127.0.0.1:3008/api/health | grep -q 'STANDBY_READONLY'
REMOTE

echo "[$(date -Is)] Standby synchronization completed"
