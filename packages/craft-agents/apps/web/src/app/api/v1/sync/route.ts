import { and, eq, gt } from 'drizzle-orm'
import type { NextRequest } from 'next/server'
import { apiError, apiSuccess, requireApiAuth } from '@/lib/api-auth'
import { db } from '@/lib/db'
import {
  browserProfiles,
  orgMembers,
  profileAssignments,
  profileGroups,
  proxies,
} from '@/lib/db/schema'

export async function GET(request: NextRequest) {
  try {
    const { orgId: authOrgId } = await requireApiAuth(request)
    const orgId = request.nextUrl.searchParams.get('orgId') || authOrgId
    if (!orgId) return apiError('orgId is required')

    const since = request.nextUrl.searchParams.get('since')
    const sinceDate = since ? new Date(parseInt(since, 10)) : new Date(0)

    const [profiles, members, groups, proxyList, assignments] =
      await Promise.all([
        db
          .select()
          .from(browserProfiles)
          .where(
            and(
              eq(browserProfiles.organizationId, orgId),
              gt(browserProfiles.updatedAt, sinceDate),
            ),
          ),
        db
          .select()
          .from(orgMembers)
          .where(
            and(
              eq(orgMembers.organizationId, orgId),
              gt(orgMembers.updatedAt, sinceDate),
            ),
          ),
        db
          .select()
          .from(profileGroups)
          .where(
            and(
              eq(profileGroups.organizationId, orgId),
              gt(profileGroups.updatedAt, sinceDate),
            ),
          ),
        db
          .select()
          .from(proxies)
          .where(
            and(
              eq(proxies.organizationId, orgId),
              gt(proxies.updatedAt, sinceDate),
            ),
          ),
        db
          .select()
          .from(profileAssignments)
          .where(eq(profileAssignments.organizationId, orgId)),
      ])

    const deletedProfiles = profiles
      .filter((p) => p.deletedAt !== null)
      .map((p) => p.id)
    const activeProfiles = profiles.filter((p) => p.deletedAt === null)

    return apiSuccess({
      serverTime: Date.now(),
      profiles: { upserted: activeProfiles, deleted: deletedProfiles },
      members: { upserted: members, deleted: [] },
      groups: { upserted: groups, deleted: [] },
      proxies: { upserted: proxyList, deleted: [] },
      assignments: { upserted: assignments, deleted: [] },
    })
  } catch (e) {
    if (e instanceof Error && 'status' in e) {
      return apiError(e.message, (e as { status: number }).status)
    }
    return apiError('Internal server error', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId, orgId: _authOrgId } = await requireApiAuth(request)
    const body = await request.json()
    const { changes } = body

    if (changes?.profiles?.upsert) {
      for (const profile of changes.profiles.upsert) {
        await db
          .insert(browserProfiles)
          .values({ ...profile, createdBy: userId })
          .onConflictDoUpdate({
            target: browserProfiles.id,
            set: {
              ...profile,
              updatedAt: new Date(),
              version: profile.version ? profile.version + 1 : 1,
            },
          })
      }
    }

    if (changes?.profiles?.delete) {
      for (const id of changes.profiles.delete) {
        await db
          .update(browserProfiles)
          .set({ deletedAt: new Date() })
          .where(eq(browserProfiles.id, id))
      }
    }

    if (changes?.groups?.upsert) {
      for (const group of changes.groups.upsert) {
        await db
          .insert(profileGroups)
          .values(group)
          .onConflictDoUpdate({
            target: profileGroups.id,
            set: { ...group, updatedAt: new Date() },
          })
      }
    }

    if (changes?.groups?.delete) {
      for (const id of changes.groups.delete) {
        await db.delete(profileGroups).where(eq(profileGroups.id, id))
      }
    }

    return apiSuccess({ ok: true, serverTime: Date.now() })
  } catch (e) {
    if (e instanceof Error && 'status' in e) {
      return apiError(e.message, (e as { status: number }).status)
    }
    return apiError('Internal server error', 500)
  }
}
