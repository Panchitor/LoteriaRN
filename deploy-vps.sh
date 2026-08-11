#!/bin/bash
set -e

cd /var/www/loteria/server

if [ ! -f .env ]; then
  echo "Missing /var/www/loteria/server/.env" >&2
  exit 1
fi

# Ensure storage directory exists
mkdir -p /var/www/loteria/storage/videos

# Install dependencies
npm install

# Apply reviewed, versioned migrations
npx prisma migrate deploy

# Build Next.js app
npm run build

# Start with PM2
pm2 delete loteria-tv || true
pm2 start npm --name "loteria-tv" -- start
pm2 save
