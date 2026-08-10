#!/bin/bash
set -e

# Sync the specific file
wsl sh -c "export SSHPASS='Canal&10&RioNegro' && cat 'src/app/api/videos/[filename]/route.ts' | sshpass -e ssh -o StrictHostKeyChecking=no -p 5753 root@149.50.139.29 'cat > \"/var/www/loteria/server/src/app/api/videos/[filename]/route.ts\"'"

# Rebuild and restart
wsl sh -c "export SSHPASS='Canal&10&RioNegro' && sshpass -e ssh -o StrictHostKeyChecking=no -p 5753 root@149.50.139.29 'cd /var/www/loteria/server && npm run build && pm2 restart loteria-tv'"
