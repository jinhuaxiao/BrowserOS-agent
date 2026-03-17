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
