#!/bin/sh
set -eu
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
. "$SCRIPT_DIR/ssh-auth.sh"
: "${LOTERIA_DB_PASSWORD:?Set LOTERIA_DB_PASSWORD in the environment}"
: "${LOTERIA_JWT_SECRET:?Set LOTERIA_JWT_SECRET in the environment}"

STAMP="$(date +%Y%m%d-%H%M%S)"

remote_ssh \
  "LOTERIA_DB_PASSWORD='$LOTERIA_DB_PASSWORD' LOTERIA_JWT_SECRET='$LOTERIA_JWT_SECRET' STAMP='$STAMP' sh -s" <<'REMOTE'
set -eu
APP_DIR=/var/www/loteria/server
BACKUP_DIR="/var/backups/loteria/security-$STAMP"
mkdir -p "$BACKUP_DIR"
cp "$APP_DIR/.env" "$BACKUP_DIR/server.env"
sudo -u postgres pg_dump -Fc loteria > "$BACKUP_DIR/loteria.dump"
chmod 600 "$BACKUP_DIR/server.env" "$BACKUP_DIR/loteria.dump"

sudo -u postgres psql -v ON_ERROR_STOP=1 -d postgres \
  --set=db_password="$LOTERIA_DB_PASSWORD" <<'SQL'
DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'loteria_app') THEN
    CREATE ROLE loteria_app LOGIN;
  END IF;
END
$do$;
ALTER ROLE loteria_app WITH LOGIN PASSWORD :'db_password';
ALTER DATABASE loteria OWNER TO loteria_app;
SQL

sudo -u postgres psql -v ON_ERROR_STOP=1 -d loteria <<'SQL'
ALTER SCHEMA public OWNER TO loteria_app;
GRANT ALL PRIVILEGES ON DATABASE loteria TO loteria_app;
GRANT ALL ON SCHEMA public TO loteria_app;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO loteria_app;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO loteria_app;
ALTER DEFAULT PRIVILEGES FOR ROLE loteria_app IN SCHEMA public GRANT ALL ON TABLES TO loteria_app;
ALTER DEFAULT PRIVILEGES FOR ROLE loteria_app IN SCHEMA public GRANT ALL ON SEQUENCES TO loteria_app;
DO $do$
DECLARE obj record;
BEGIN
  FOR obj IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I OWNER TO loteria_app', obj.tablename);
  END LOOP;
  FOR obj IN SELECT sequencename FROM pg_sequences WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER SEQUENCE public.%I OWNER TO loteria_app', obj.sequencename);
  END LOOP;
  FOR obj IN SELECT viewname FROM pg_views WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER VIEW public.%I OWNER TO loteria_app', obj.viewname);
  END LOOP;
END
$do$;
SQL

node - "$APP_DIR/.env" "$LOTERIA_DB_PASSWORD" "$LOTERIA_JWT_SECRET" <<'NODE'
const fs = require('fs');
const [path, password, jwt] = process.argv.slice(2);
let env = fs.readFileSync(path, 'utf8');
const dbUrl = `postgresql://loteria_app:${password}@localhost:5432/loteria?schema=public`;
const set = (key, value) => {
  const line = `${key}=${JSON.stringify(value)}`;
  const re = new RegExp(`^${key}=.*$`, 'm');
  env = re.test(env) ? env.replace(re, line) : `${env.trimEnd()}\n${line}\n`;
};
set('DATABASE_URL', dbUrl);
set('JWT_SECRET', jwt);
fs.writeFileSync(path, env, { mode: 0o600 });
NODE

cd "$APP_DIR"
npx prisma migrate status
pm2 restart loteria-tv --update-env
pm2 restart loteria-watchdog --update-env
pm2 save
sleep 3
curl -fsS http://127.0.0.1:3008/login >/dev/null
curl -fsS http://127.0.0.1:3008/api/manifest >/dev/null
echo "Loteria credentials rotated; backup=$BACKUP_DIR"
REMOTE
