import { eq } from 'drizzle-orm'
import * as jose from 'jose'
import { NextResponse } from 'next/server'
import { requireApiSession } from '@/lib/api-auth'
import { db } from '@/lib/db'
import { orgMembers } from '@/lib/db/schema'

const secret = new TextEncoder().encode(
  process.env.BETTER_AUTH_SECRET || 'dev-secret',
)

export async function GET() {
  try {
    const session = await requireApiSession()
    const userId = session.user.id

    // Find the user's first org membership
    const [membership] = await db
      .select({ organizationId: orgMembers.organizationId })
      .from(orgMembers)
      .where(eq(orgMembers.userId, userId))
      .limit(1)

    const token = await new jose.SignJWT({
      orgId: membership?.organizationId || '',
    })
      .setSubject(userId)
      .setIssuedAt()
      .setExpirationTime('1h')
      .setProtectedHeader({ alg: 'HS256' })
      .sign(secret)

    return NextResponse.json({ token })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
