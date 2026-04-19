import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const token = await prisma.googleToken.findUnique({ where: { id: 'singleton' } })
    return NextResponse.json({
      connected: !!token,
      lastSynced: token?.updatedAt?.toISOString() ?? null,
    })
  } catch {
    return NextResponse.json({ connected: false, lastSynced: null })
  }
}

export async function DELETE() {
  try {
    await prisma.googleToken.delete({ where: { id: 'singleton' } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: true }) // already disconnected
  }
}
