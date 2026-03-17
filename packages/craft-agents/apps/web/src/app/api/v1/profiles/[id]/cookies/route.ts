import type { NextRequest } from 'next/server'
import { apiError, apiSuccess, requireApiSession } from '@/lib/api-auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireApiSession()
    const { id } = await params
    // Phase 3: Download cookies from S3/R2
    return apiError('Cookie storage not yet implemented', 501)
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
    await requireApiSession()
    const { id } = await params
    // Phase 3: Upload cookies to S3/R2
    return apiError('Cookie storage not yet implemented', 501)
  } catch (e) {
    if (e instanceof Error && 'status' in e) {
      return apiError(e.message, (e as { status: number }).status)
    }
    return apiError('Internal server error', 500)
  }
}
