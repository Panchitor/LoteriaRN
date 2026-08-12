#!/bin/bash
: "${SSHPASS:?Set SSHPASS in the environment}"
sshpass -e ssh -o StrictHostKeyChecking=no -p 5753 root@149.50.139.29 << 'EOF'
cd /var/www/loteria/server
npm run build
pm2 restart loteria-tv
EOF
