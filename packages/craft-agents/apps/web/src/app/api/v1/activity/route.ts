import { desc, eq } from 'drizzle-orm'
import type { NextRequest } from 'next/server'
import { apiError, apiSuccess, requireApiSession } from '@/lib/api-auth'
import { db } from '@/lib/db'
import { activityLogs } from '@/lib/db/schema'

export async function GET(request: NextRequest) {
  try {
    await requireApiSession()
    const orgId = request.nextUrl.searchParams.get('orgId')
    if (!orgId) return apiError('orgId is required')

    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '50')

    const logs = await db
      .select()
      .from(activityLogs)
      .where(eq(activityLogs.organizationId, orgId))
      .orderBy(desc(activityLogs.createdAt))
      .limit(limit)

    return apiSuccess(logs)
  } catch (e) {
    if (e instanceof Error && 'status' in e) {
      return apiError(e.message, (e as { status: number }).status)
    }
    return apiError('Internal server error', 500)
  }
}
