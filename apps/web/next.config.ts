import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  allowedDevOrigins: ['127.0.0.1'],
  devIndicators: false,
  reactStrictMode: true,
  transpilePackages: ['@forgeboard/api-client', '@forgeboard/ui'],
}

export default nextConfig
