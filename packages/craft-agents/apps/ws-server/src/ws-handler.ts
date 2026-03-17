import type { ServerWebSocket } from 'bun'
import { presenceTracker } from './presence'

export interface WsContext {
  clientId: string
  userId: string
  orgId: string
  deviceId: string
  connectedAt: number
  hostname?: string
  os?: string
  appVersion?: string
  runningProfiles?: string[]
  lastHeartbeatAt?: number
  ws?: ServerWebSocket<WsContext>
}

const lockedProfiles = new Map<string, { userId: string; clientId: string }>()

const MCP_CALL_TIMEOUT = 30_000
const pendingMcpCalls = new Map<
  string,
  { fromClientId: string; timer: ReturnType<typeof setTimeout> }
>()

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

    case 'device.info': {
      presenceTracker.updateDeviceInfo(ctx.clientId, {
        hostname: parsed.hostname as string,
        os: parsed.os as string,
        appVersion: parsed.appVersion as string,
        runningProfiles: parsed.runningProfiles as string[],
      })
      break
    }

    case 'device.heartbeat': {
      presenceTracker.updateDeviceInfo(ctx.clientId, {
        runningProfiles: parsed.runningProfiles as string[],
      })
      break
    }

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

    case 'mcp.call': {
      const requestId = parsed.requestId as string
      const targetDeviceId = parsed.targetDeviceId as string
      const profileId = parsed.profileId as string
      const toolName = parsed.toolName as string
      const args = (parsed.args as Record<string, unknown>) || {}

      const targetCtx = presenceTracker.findClientByDeviceId(
        ctx.orgId,
        targetDeviceId,
      )

      if (!targetCtx) {
        ws.send(
          JSON.stringify({
            type: 'mcp.result',
            requestId,
            success: false,
            error: 'Device offline',
          }),
        )
        break
      }

      if (!targetCtx.runningProfiles?.includes(profileId)) {
        ws.send(
          JSON.stringify({
            type: 'mcp.result',
            requestId,
            success: false,
            error: 'Profile not running',
          }),
        )
        break
      }

      const timer = setTimeout(() => {
        pendingMcpCalls.delete(requestId)
        presenceTracker.sendToClient(
          ctx.clientId,
          JSON.stringify({
            type: 'mcp.result',
            requestId,
            success: false,
            error: 'Timeout',
          }),
        )
      }, MCP_CALL_TIMEOUT)

      pendingMcpCalls.set(requestId, { fromClientId: ctx.clientId, timer })

      presenceTracker.sendToClient(
        targetCtx.clientId,
        JSON.stringify({
          type: 'mcp.call',
          requestId,
          profileId,
          toolName,
          args,
        }),
      )
      break
    }

    case 'mcp.result': {
      const requestId = parsed.requestId as string
      const pending = pendingMcpCalls.get(requestId)
      if (pending) {
        clearTimeout(pending.timer)
        pendingMcpCalls.delete(requestId)
        presenceTracker.sendToClient(
          pending.fromClientId,
          JSON.stringify({
            type: 'mcp.result',
            requestId,
            success: parsed.success as boolean,
            data: parsed.data,
            error: parsed.error as string | undefined,
          }),
        )
      }
      break
    }
  }
}
