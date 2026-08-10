export SSHPASS='Canal&10&RioNegro'
sshpass -e ssh -o StrictHostKeyChecking=no -p 5753 root@149.50.139.29 << 'EOF'
cat << 'NGINX_CONF' > /etc/nginx/sites-available/loteria
server {
    server_name loteriarn.patagonialive.media;

    location /apk/ {
        alias /var/www/loteria/server/public/apk/;
        autoindex off;
    }

    location / {
        proxy_pass http://localhost:3008;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        client_max_body_size 500M;
    }

    listen 443 ssl; # managed by Certbot
    ssl_certificate /etc/letsencrypt/live/loteriarn.patagonialive.media/fullchain.pem; # managed by Certbot
    ssl_certificate_key /etc/letsencrypt/live/loteriarn.patagonialive.media/privkey.pem; # managed by Certbot
    include /etc/letsencrypt/options-ssl-nginx.conf; # managed by Certbot
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem; # managed by Certbot
}
server {
    if ($host = loteriarn.patagonialive.media) {
        return 301 https://$host$request_uri;
    } # managed by Certbot

    server_name loteriarn.patagonialive.media;
    listen 80;
    return 404; # managed by Certbot
}
NGINX_CONF

systemctl restart nginx
EOF
