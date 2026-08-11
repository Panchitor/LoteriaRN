#!/bin/sh
set -eu
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
. "$SCRIPT_DIR/ssh-auth.sh"

remote_ssh <<'EOF'
sudo -u postgres psql -d loteria -c '
SELECT d.id, a.number AS agency, a.subagency_number AS subagency,
       d.tv_number, d.app_version, d.android_version,
       d.device_model, d.device_serial, d.is_active,
       (d.installation_id IS NOT NULL) AS linked, d.revoked_at, d.last_seen
FROM "Device" d
JOIN "Agency" a ON a.id = d.agency_id
ORDER BY d.last_seen DESC;'
EOF
