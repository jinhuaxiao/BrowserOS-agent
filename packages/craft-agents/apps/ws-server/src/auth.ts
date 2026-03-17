import * as jose from 'jose'

const secret = new TextEncoder().encode(
  process.env.BETTER_AUTH_SECRET || 'dev-secret',
)

export interface TokenPayload {
  userId: string
  orgId?: string
}

export async function verifyToken(token: string): Promise<TokenPayload | null> {
  // API key auth (for Electron clients)
  const apiKey = process.env.SYNC_API_KEY
  if (apiKey && token === apiKey) {
    const orgId = process.env.SYNC_ORG_ID || ''
    return { userId: 'sync-client', orgId }
  }

  // JWT auth (for web clients)
  try {
    const { payload } = await jose.jwtVerify(token, secret)
    return {
      userId: payload.sub as string,
      orgId: payload.orgId as string | undefined,
    }
  } catch {
    return null
  }
}
