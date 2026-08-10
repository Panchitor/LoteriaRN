#!/bin/bash
set -e

export SSHPASS="Canal&10&RioNegro"

# Create downloads dir
sshpass -e ssh -o StrictHostKeyChecking=no -p 5753 root@149.50.139.29 "mkdir -p /var/www/loteria/server/public/downloads"

# Upload APK
echo "Uploading APK..."
sshpass -e scp -o StrictHostKeyChecking=no -P 5753 /mnt/host/c/LotAgencia/app-tv/android/app/build/outputs/apk/release/app-release.apk root@149.50.139.29:/var/www/loteria/server/public/downloads/update.apk

# Update Database
echo "Updating Database for OTA..."
sshpass -e ssh -o StrictHostKeyChecking=no -p 5753 root@149.50.139.29 << 'EOF'
sudo -u postgres psql -d loteria -c "INSERT INTO \"SystemConfig\" (key, value, updated_at) VALUES ('LATEST_APK_VERSION', '1.0.18', NOW()) ON CONFLICT (key) DO UPDATE SET value = '1.0.18', updated_at = NOW();"
sudo -u postgres psql -d loteria -c "INSERT INTO \"SystemConfig\" (key, value, updated_at) VALUES ('LATEST_APK_URL', 'https://loteriarn.patagonialive.media/downloads/update.apk', NOW()) ON CONFLICT (key) DO UPDATE SET value = 'https://loteriarn.patagonialive.media/downloads/update.apk', updated_at = NOW();"
EOF

echo "Deployment complete."
