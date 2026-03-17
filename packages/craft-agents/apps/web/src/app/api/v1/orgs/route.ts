import { eq } from 'drizzle-orm'
import type { NextRequest } from 'next/server'
import { apiError, apiSuccess, requireApiSession } from '@/lib/api-auth'
import { db } from '@/lib/db'
import { organizations, orgMembers } from '@/lib/db/schema'

export async function GET() {
  try {
    const session = await requireApiSession()

    const memberships = await db
      .select({
        org: organizations,
        role: orgMembers.role,
      })
      .from(orgMembers)
      .innerJoin(organizations, eq(orgMembers.organizationId, organizations.id))
      .where(eq(orgMembers.userId, session.user.id))

    return apiSuccess(memberships)
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
    const { name, slug } = await request.json()

    if (!name || !slug) return apiError('name and slug are required')

    const [org] = await db
      .insert(organizations)
      .values({
        name,
        slug,
        ownerId: session.user.id,
      })
      .returning()

    if (!org) return apiError('Failed to create organization', 500)

    await db.insert(orgMembers).values({
      organizationId: org.id,
      userId: session.user.id,
      role: 'owner',
      displayName: session.user.name,
    })

    return apiSuccess(org, 201)
  } catch (e) {
    if (e instanceof Error && 'status' in e) {
      return apiError(e.message, (e as { status: number }).status)
    }
    return apiError('Internal server error', 500)
  }
}
