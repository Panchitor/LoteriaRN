#!/bin/bash
set -e

cd /var/www/loteria/server

cat << 'EOF' > next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    middlewareClientMaxBodySize: '500mb',
  },
};

export default nextConfig;
EOF

npm run build
pm2 restart loteria-tv
