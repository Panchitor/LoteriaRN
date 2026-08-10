export SSHPASS='Canal&10&RioNegro'
sshpass -e ssh -o StrictHostKeyChecking=no -p 5753 root@149.50.139.29 << 'EOF'
sudo -u postgres psql -d loteria -c "UPDATE \"SystemConfig\" SET value='1.0.20' WHERE key='LATEST_APK_VERSION';"
sudo -u postgres psql -d loteria -c "UPDATE \"SystemConfig\" SET value='http://149.50.139.29/apk/loteria-tv-v1_0_20.apk' WHERE key='LATEST_APK_URL';"
EOF
