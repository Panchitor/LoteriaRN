#!/bin/bash
set -e

# Create Nginx virtual host
cat << 'EOF' > /etc/nginx/sites-available/loteria
server {
    listen 80;
    server_name loteriarn.patagonialive.media;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        # For video uploads up to 500MB
        client_max_body_size 500M;
    }
}
EOF

# Enable the site
ln -sf /etc/nginx/sites-available/loteria /etc/nginx/sites-enabled/

# Test Nginx and reload
nginx -t
systemctl reload nginx

# Run certbot to get SSL (optional/fail-safe)
# certbot --nginx -d loteriarn.patagonialive.media --non-interactive --agree-tos --register-unsafely-without-email || echo "Certbot SSL failed or already exists, skipping."
