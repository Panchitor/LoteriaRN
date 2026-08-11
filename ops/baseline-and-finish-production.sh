#!/bin/sh
set -eu

: "${SSHPASS:?Set SSHPASS in the environment}"

HOST="root@149.50.139.29"
PORT="5753"
SSH="sshpass -e ssh -o StrictHostKeyChecking=accept-new -p ${PORT} ${HOST}"
MIGRATION="20260810160000_agency_hierarchy_and_device_identity"

echo "Applying additive migration in a transaction"
$SSH "set -eu; cd /var/www/loteria/server; sudo -u postgres psql -v ON_ERROR_STOP=1 -d loteria <<'SQL'
BEGIN;
\i prisma/migrations/${MIGRATION}/migration.sql
COMMIT;
SQL
npx prisma migrate resolve --applied '${MIGRATION}'; NODE_ENV=production npm run build; pm2 restart loteria-tv --update-env; pm2 save"

echo "Running local and public smoke tests"
$SSH "set -eu; sleep 3; curl -fsS http://127.0.0.1:3008/login >/dev/null; curl -fsS http://127.0.0.1:3008/api/manifest >/dev/null; curl -fsS https://loteriarn.patagonialive.media/api/manifest >/dev/null; sudo -u postgres psql -d loteria -Atc \"SELECT column_name FROM information_schema.columns WHERE table_name='Agency' AND column_name IN ('parent_id','status') ORDER BY column_name; SELECT column_name FROM information_schema.columns WHERE table_name='Device' AND column_name IN ('installation_id','revoked_at') ORDER BY column_name;\"; pm2 describe loteria-tv | grep -E 'status|uptime|restarts'"

echo "Production migration and deployment completed"
