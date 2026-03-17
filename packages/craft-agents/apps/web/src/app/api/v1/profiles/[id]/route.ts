import { eq } from 'drizzle-orm'
import type { NextRequest } from 'next/server'
import { apiError, apiSuccess, requireApiSession } from '@/lib/api-auth'
import { db } from '@/lib/db'
import { browserProfiles } from '@/lib/db/schema'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireApiSession()
    const { id } = await params

    const [profile] = await db
      .select()
      .from(browserProfiles)
      .where(eq(browserProfiles.id, id))

    if (!profile) return apiError('Profile not found', 404)
    return apiSuccess(profile)
  } catch (e) {
    if (e instanceof Error && 'status' in e) {
      return apiError(e.message, (e as { status: number }).status)
    }
    return apiError('Internal server error', 500)
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireApiSession()
    const { id } = await params
    const body = await request.json()

    const [profile] = await db
      .update(browserProfiles)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(browserProfiles.id, id))
      .returning()

    if (!profile) return apiError('Profile not found', 404)
    return apiSuccess(profile)
  } catch (e) {
    if (e instanceof Error && 'status' in e) {
      return apiError(e.message, (e as { status: number }).status)
    }
    return apiError('Internal server error', 500)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireApiSession()
    const { id } = await params

    const [profile] = await db
      .update(browserProfiles)
      .set({ deletedAt: new Date() })
      .where(eq(browserProfiles.id, id))
      .returning()

    if (!profile) return apiError('Profile not found', 404)
    return apiSuccess({ ok: true })
  } catch (e) {
    if (e instanceof Error && 'status' in e) {
      return apiError(e.message, (e as { status: number }).status)
    }
    return apiError('Internal server error', 500)
  }
}
