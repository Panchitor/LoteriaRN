#!/bin/bash
set -e

cd /var/www/loteria/server

# Configure .env
cat << 'EOF' > .env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/loteria?schema=public"
STORAGE_PATH="/var/www/loteria/storage/videos"
NEXT_PUBLIC_APP_URL="http://loteriarn.patagonialive.media"
EOF

# Ensure storage directory exists
mkdir -p /var/www/loteria/storage/videos

# Install dependencies
npm install

# Push database schema
npx prisma db push

# Build Next.js app
npm run build

# Start with PM2
pm2 delete loteria-tv || true
pm2 start npm --name "loteria-tv" -- start
pm2 save
