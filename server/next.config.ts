import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '500mb',
    },
    proxyPrefetch: 'flexible',
  },
  output: 'standalone',
  serverExternalPackages: ['@prisma/client', 'bcryptjs', 'fluent-ffmpeg', '@ffmpeg-installer/ffmpeg'],
};

export default nextConfig;
