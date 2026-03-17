import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { auth } from './auth'

export async function getApiSession() {
  const session = await auth.api.getSession({
    headers: await headers(),
  })
  return session
}

export async function requireApiSession() {
  const session = await getApiSession()
  if (!session) {
    throw new ApiError('Unauthorized', 401)
  }
  return session
}

/**
 * Dual-mode authentication: Better Auth session (Web) or API Key (Electron).
 *
 * API Key mode: Authorization: Bearer <SYNC_API_KEY>
 * Requires orgId query parameter to identify the organization.
 */
export async function requireApiAuth(request: Request) {
  const headersList = await headers()
  const authHeader = headersList.get('authorization')

  // Try API Key authentication first
  const syncApiKey = process.env.SYNC_API_KEY
  if (syncApiKey && authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    if (token === syncApiKey) {
      const url = new URL(request.url)
      const orgId = url.searchParams.get('orgId')
      if (!orgId) {
        throw new ApiError(
          'orgId query parameter is required for API key auth',
          400,
        )
      }
      return { userId: 'sync-client', orgId }
    }
  }

  // Fall back to Better Auth session
  const session = await auth.api.getSession({
    headers: headersList,
  })
  if (!session) {
    throw new ApiError('Unauthorized', 401)
  }
  return { userId: session.user.id, orgId: null as string | null }
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number = 400,
  ) {
    super(message)
  }
}

export function apiError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json(data, { status })
}
