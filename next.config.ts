import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Prisma and googleapis run server-side only
  serverExternalPackages: ['@prisma/client', 'googleapis'],
  // Silence Turbopack "no webpack config" warning
  turbopack: {},
}

export default nextConfig
