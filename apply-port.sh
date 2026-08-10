#!/bin/bash
set -e

# Configurar Nginx para apuntar al puerto 3005
cat << 'EOF' > /etc/nginx/sites-available/loteria
server {
    listen 80;
    server_name loteriarn.patagonialive.media;

    location / {
        proxy_pass http://localhost:3005;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        client_max_body_size 500M;
    }
}
EOF

ln -sf /etc/nginx/sites-available/loteria /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx || true

# Cambiar puerto de PM2
cd /var/www/loteria/server
pm2 delete loteria-tv || true
PORT=3005 pm2 start npm --name "loteria-tv" -- start -- -p 3005
pm2 save
