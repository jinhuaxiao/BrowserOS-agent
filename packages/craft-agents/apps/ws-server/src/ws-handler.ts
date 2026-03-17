import type { ServerWebSocket } from 'bun'
import { presenceTracker } from './presence'

export interface WsContext {
  clientId: string
  userId: string
  orgId: string
  deviceId: string
  connectedAt: number
  ws?: ServerWebSocket<WsContext>
}

const lockedProfiles = new Map<string, { userId: string; clientId: string }>()

export function handleWebSocket(
  ws: ServerWebSocket<WsContext>,
  message: string | Buffer,
) {
  const ctx = ws.data as WsContext
  ctx.ws = ws

  let parsed: { type: string; [key: string]: unknown }
  try {
    parsed = JSON.parse(
      typeof message === 'string' ? message : message.toString(),
    )
  } catch {
    return
  }

  switch (parsed.type) {
    case 'ping':
      ws.send(JSON.stringify({ type: 'pong' }))
      break

    case 'profile.lock': {
      const profileId = parsed.profileId as string
      if (!lockedProfiles.has(profileId)) {
        lockedProfiles.set(profileId, {
          userId: ctx.userId,
          clientId: ctx.clientId,
        })
        presenceTracker.broadcastToOrg(
          ctx.orgId,
          JSON.stringify({
            type: 'profile.locked',
            profileId,
            userId: ctx.userId,
          }),
        )
      }
      break
    }

    case 'profile.unlock': {
      const profileId = parsed.profileId as string
      const lock = lockedProfiles.get(profileId)
      if (lock?.clientId === ctx.clientId) {
        lockedProfiles.delete(profileId)
        presenceTracker.broadcastToOrg(
          ctx.orgId,
          JSON.stringify({
            type: 'profile.unlocked',
            profileId,
          }),
        )
      }
      break
    }
  }
}
