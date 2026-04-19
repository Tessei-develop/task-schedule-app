import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

// Lazy singleton — only instantiated on first use, not at module load time.
// This prevents build failures when DATABASE_URL is not set in the build env.
let _prisma: PrismaClient | undefined

export function getPrisma(): PrismaClient {
  if (!_prisma) {
    const connectionString = process.env.DATABASE_URL
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is not set')
    }
    const adapter = new PrismaPg({ connectionString })
    _prisma = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0])
  }
  return _prisma
}

// Convenience alias — same ergonomics as before for all existing imports
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    return (getPrisma() as unknown as Record<string | symbol, unknown>)[prop]
  },
})
