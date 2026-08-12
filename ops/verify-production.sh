#!/bin/sh
set -eu
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
. "$SCRIPT_DIR/ssh-auth.sh"

remote_ssh <<'REMOTE'
set -eu
pm2 logs loteria-tv --lines 40 --nostream
sudo -u postgres psql -d loteria <<'SQL'
SELECT d.app_version, d.status, d.last_seen, d.playback_status, a.number AS agency
FROM "Device" d
JOIN "Agency" a ON a.id = d.agency_id
ORDER BY d.last_seen DESC
LIMIT 5;
SQL
REMOTE
