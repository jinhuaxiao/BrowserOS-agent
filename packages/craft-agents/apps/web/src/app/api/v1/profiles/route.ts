import { and, eq, isNull } from 'drizzle-orm'
import type { NextRequest } from 'next/server'
import { apiError, apiSuccess, requireApiSession } from '@/lib/api-auth'
import { db } from '@/lib/db'
import { browserProfiles } from '@/lib/db/schema'

export async function GET(request: NextRequest) {
  try {
    const session = await requireApiSession()
    const orgId = request.nextUrl.searchParams.get('orgId')
    if (!orgId) return apiError('orgId is required')

    const profiles = await db
      .select()
      .from(browserProfiles)
      .where(
        and(
          eq(browserProfiles.organizationId, orgId),
          isNull(browserProfiles.deletedAt),
        ),
      )

    return apiSuccess(profiles)
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

    const [profile] = await db
      .insert(browserProfiles)
      .values({
        ...body,
        createdBy: session.user.id,
      })
      .returning()

    return apiSuccess(profile, 201)
  } catch (e) {
    if (e instanceof Error && 'status' in e) {
      return apiError(e.message, (e as { status: number }).status)
    }
    return apiError('Internal server error', 500)
  }
}
