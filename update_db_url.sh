: "${SSHPASS:?Set SSHPASS in the environment}"
sshpass -e ssh -o StrictHostKeyChecking=no -p 5753 root@149.50.139.29 << 'EOF'
sudo -u postgres psql -d loteria -c "UPDATE \"SystemConfig\" SET value='https://loteriarn.patagonialive.media/apk/loteria-tv-v1_0_20.apk' WHERE key='LATEST_APK_URL';"
EOF
