import { eq } from 'drizzle-orm'
import type { NextRequest } from 'next/server'
import { apiError, apiSuccess, requireApiSession } from '@/lib/api-auth'
import { db } from '@/lib/db'
import { profileGroups } from '@/lib/db/schema'

export async function GET(request: NextRequest) {
  try {
    await requireApiSession()
    const orgId = request.nextUrl.searchParams.get('orgId')
    if (!orgId) return apiError('orgId is required')

    const groups = await db
      .select()
      .from(profileGroups)
      .where(eq(profileGroups.organizationId, orgId))

    return apiSuccess(groups)
  } catch (e) {
    if (e instanceof Error && 'status' in e) {
      return apiError(e.message, (e as { status: number }).status)
    }
    return apiError('Internal server error', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireApiSession()
    const body = await request.json()

    const [group] = await db.insert(profileGroups).values(body).returning()

    return apiSuccess(group, 201)
  } catch (e) {
    if (e instanceof Error && 'status' in e) {
      return apiError(e.message, (e as { status: number }).status)
    }
    return apiError('Internal server error', 500)
  }
}
