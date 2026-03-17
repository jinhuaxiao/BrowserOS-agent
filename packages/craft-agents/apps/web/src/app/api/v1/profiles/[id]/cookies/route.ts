import { eq } from 'drizzle-orm'
import type { NextRequest } from 'next/server'
import { apiError, apiSuccess, requireApiAuth } from '@/lib/api-auth'
import { db } from '@/lib/db'
import { browserProfiles } from '@/lib/db/schema'
import { downloadCookies, uploadCookies } from '@/lib/r2'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireApiAuth(request)
    const { id } = await params

    // Check if profile exists
    const [profile] = await db
      .select({
        id: browserProfiles.id,
        cookiesUrl: browserProfiles.cookiesUrl,
      })
      .from(browserProfiles)
      .where(eq(browserProfiles.id, id))
      .limit(1)

    if (!profile) return apiError('Profile not found', 404)
    if (!profile.cookiesUrl) return apiSuccess([])

    const cookies = await downloadCookies(id)
    return apiSuccess(cookies ?? [])
  } catch (e) {
    if (e instanceof Error && 'status' in e) {
      return apiError(e.message, (e as { status: number }).status)
    }
    return apiError('Internal server error', 500)
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireApiAuth(request)
    const { id } = await params
    const cookies = await request.json()

    if (!Array.isArray(cookies)) {
      return apiError('Request body must be a JSON array of cookies')
    }

    // Upload to R2
    const cookiesUrl = await uploadCookies(id, cookies)

    // Update profile record with cookies URL
    await db
      .update(browserProfiles)
      .set({
        cookiesUrl,
        cookiesUpdatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(browserProfiles.id, id))

    return apiSuccess({
      cookiesUrl,
      count: cookies.length,
      updatedAt: new Date().toISOString(),
    })
  } catch (e) {
    if (e instanceof Error && 'status' in e) {
      return apiError(e.message, (e as { status: number }).status)
    }
    return apiError('Internal server error', 500)
  }
}
