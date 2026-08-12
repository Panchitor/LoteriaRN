#!/bin/bash
set -e
: "${SSHPASS:?Set SSHPASS in the environment}"
cd /mnt/host/c/LotAgencia/server

echo "Tarring .next..."
tar -czf next-build.tar.gz .next next.config.ts package.json package-lock.json || true

echo "Uploading..."
sshpass -e scp -o StrictHostKeyChecking=no -P 5753 next-build.tar.gz root@149.50.139.29:/var/www/loteria/server/

echo "Extracting and restarting..."
sshpass -e ssh -o StrictHostKeyChecking=no -p 5753 root@149.50.139.29 << 'EOF'
cd /var/www/loteria/server
rm -rf .next
tar -xzf next-build.tar.gz
rm next-build.tar.gz
npm install --production
pm2 restart loteria-tv
EOF
echo "Done"
