import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  transpilePackages: ['@forgeboard/api-client', '@forgeboard/ui'],
}

export default nextConfig
