import { and, count, eq, gte, isNull } from 'drizzle-orm'
import { apiError, apiSuccess, requireApiSession } from '@/lib/api-auth'
import { db } from '@/lib/db'
import {
  activityLogs,
  browserProfiles,
  orgMembers,
  proxies,
} from '@/lib/db/schema'

export async function GET() {
  try {
    const session = await requireApiSession()

    // Get user's first organization
    const membership = await db
      .select({ organizationId: orgMembers.organizationId })
      .from(orgMembers)
      .where(eq(orgMembers.userId, session.user.id))
      .limit(1)

    const org = membership[0]
    if (!org) {
      return apiSuccess({
        profiles: 0,
        members: 0,
        proxies: 0,
        actionsToday: 0,
      })
    }

    const orgId = org.organizationId

    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const [profileCount, memberCount, proxyCount, activityCount] =
      await Promise.all([
        db
          .select({ count: count() })
          .from(browserProfiles)
          .where(
            and(
              eq(browserProfiles.organizationId, orgId),
              isNull(browserProfiles.deletedAt),
            ),
          ),
        db
          .select({ count: count() })
          .from(orgMembers)
          .where(eq(orgMembers.organizationId, orgId)),
        db
          .select({ count: count() })
          .from(proxies)
          .where(eq(proxies.organizationId, orgId)),
        db
          .select({ count: count() })
          .from(activityLogs)
          .where(
            and(
              eq(activityLogs.organizationId, orgId),
              gte(activityLogs.createdAt, todayStart),
            ),
          ),
      ])

    return apiSuccess({
      profiles: profileCount[0]?.count ?? 0,
      members: memberCount[0]?.count ?? 0,
      proxies: proxyCount[0]?.count ?? 0,
      actionsToday: activityCount[0]?.count ?? 0,
      orgId,
    })
  } catch (e) {
    if (e instanceof Error && 'status' in e) {
      return apiError(e.message, (e as { status: number }).status)
    }
    return apiError('Internal server error', 500)
  }
}
