#!/bin/sh
set -eu
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
. "$SCRIPT_DIR/ssh-auth.sh"

remote_ssh <<'REMOTE'
set -eu
echo PM2_APPS
pm2 list
echo LOTERIA_ENV_KEYS
sed -n 's/^\([A-Za-z_][A-Za-z0-9_]*\)=.*/\1/p' /var/www/loteria/server/.env
echo DB_TARGET
cd /var/www/loteria/server
node - <<'NODE'
require('dotenv').config();
const u = new URL(process.env.DATABASE_URL);
console.log(`user=${u.username} host=${u.hostname} port=${u.port || '5432'} db=${u.pathname.slice(1)}`);
NODE
echo DB_ROLES
sudo -u postgres psql -Atd postgres -c "SELECT rolname||'|login='||rolcanlogin FROM pg_roles ORDER BY rolname"
REMOTE
