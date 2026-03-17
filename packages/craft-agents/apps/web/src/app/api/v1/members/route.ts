import { and, eq } from 'drizzle-orm'
import type { NextRequest } from 'next/server'
import { apiError, apiSuccess, requireApiSession } from '@/lib/api-auth'
import { db } from '@/lib/db'
import { orgMembers, user } from '@/lib/db/schema'

export async function GET(request: NextRequest) {
  try {
    await requireApiSession()
    const orgId = request.nextUrl.searchParams.get('orgId')
    if (!orgId) return apiError('orgId is required')

    const members = await db
      .select({
        member: orgMembers,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
        },
      })
      .from(orgMembers)
      .innerJoin(user, eq(orgMembers.userId, user.id))
      .where(eq(orgMembers.organizationId, orgId))

    return apiSuccess(members)
  } catch (e) {
    if (e instanceof Error && 'status' in e) {
      return apiError(e.message, (e as { status: number }).status)
    }
    return apiError('Internal server error', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireApiSession()
    const body = await request.json()

    const [member] = await db.insert(orgMembers).values(body).returning()

    return apiSuccess(member, 201)
  } catch (e) {
    if (e instanceof Error && 'status' in e) {
      return apiError(e.message, (e as { status: number }).status)
    }
    return apiError('Internal server error', 500)
  }
}
