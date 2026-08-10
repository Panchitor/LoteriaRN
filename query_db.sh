export SSHPASS='Canal&10&RioNegro'
sshpass -e ssh -o StrictHostKeyChecking=no -p 5753 root@149.50.139.29 << 'EOF'
sudo -u postgres psql -d loteria -c 'SELECT * FROM "SystemConfig";'
EOF
