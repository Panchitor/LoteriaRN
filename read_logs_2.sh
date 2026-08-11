: "${SSHPASS:?Set SSHPASS in the environment}"
sshpass -e ssh -o StrictHostKeyChecking=no -p 5753 root@149.50.139.29 << 'EOF'
sudo -u postgres psql -d loteria -c "SELECT message FROM \"DeviceLog\" ORDER BY created_at DESC LIMIT 10;"
EOF
