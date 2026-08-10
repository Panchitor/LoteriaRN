#!/bin/bash
set -e
cd /var/www/loteria/server
npx prisma generate
npm run build
pm2 delete loteria-tv || true
pm2 start npm --name "loteria-tv" -- start
pm2 save
