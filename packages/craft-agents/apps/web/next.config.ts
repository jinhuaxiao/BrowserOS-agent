import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@craft-agent/core', '@craft-agent/shared'],
}

export default nextConfig
