import type { PresenceInfo } from '@craft-agent/shared/sync/types'
import type { WsContext } from './ws-handler'

class PresenceTracker {
  private clients = new Map<string, WsContext>()

  addClient(ctx: WsContext) {
    this.clients.set(ctx.clientId, ctx)
    this.broadcastPresence(ctx.orgId)
  }

  removeClient(ctx: WsContext) {
    this.clients.delete(ctx.clientId)
    this.broadcastPresence(ctx.orgId)
  }

  getClient(clientId: string): WsContext | undefined {
    return this.clients.get(clientId)
  }

  getOrgClients(orgId: string): WsContext[] {
    return Array.from(this.clients.values()).filter((c) => c.orgId === orgId)
  }

  updateDeviceInfo(
    clientId: string,
    info: {
      hostname?: string
      os?: string
      appVersion?: string
      runningProfiles?: string[]
    },
  ) {
    const ctx = this.clients.get(clientId)
    if (!ctx) return

    if (info.hostname) ctx.hostname = info.hostname
    if (info.os) ctx.os = info.os
    if (info.appVersion) ctx.appVersion = info.appVersion
    if (info.runningProfiles) ctx.runningProfiles = info.runningProfiles
    ctx.lastHeartbeatAt = Date.now()

    this.broadcastPresence(ctx.orgId)
  }

  broadcastPresence(orgId: string) {
    const clients = this.getOrgClients(orgId)

    // Deduplicate by deviceId, keeping the most recent connection
    const byDevice = new Map<string, WsContext>()
    for (const c of clients) {
      const existing = byDevice.get(c.deviceId)
      if (!existing || c.connectedAt > existing.connectedAt) {
        byDevice.set(c.deviceId, c)
      }
    }

    // Only include non-web devices in presence (Electron clients)
    const members: PresenceInfo[] = Array.from(byDevice.values())
      .filter((c) => !c.deviceId.startsWith('web-'))
      .map((c) => ({
        userId: c.userId,
        orgId: c.orgId,
        deviceId: c.deviceId,
        connectedAt: c.connectedAt,
        hostname: c.hostname,
        os: c.os,
        appVersion: c.appVersion,
        runningProfiles: c.runningProfiles,
        lastHeartbeatAt: c.lastHeartbeatAt,
      }))

    const message = JSON.stringify({ type: 'presence', members })
    for (const client of clients) {
      client.ws?.send(message)
    }
  }

  broadcastToOrg(orgId: string, message: string, excludeClientId?: string) {
    const clients = this.getOrgClients(orgId)
    for (const client of clients) {
      if (client.clientId !== excludeClientId) {
        client.ws?.send(message)
      }
    }
  }

  sendToClient(clientId: string, message: string): boolean {
    const ctx = this.clients.get(clientId)
    if (ctx?.ws) {
      ctx.ws.send(message)
      return true
    }
    return false
  }

  findClientByDeviceId(orgId: string, deviceId: string): WsContext | undefined {
    return this.getOrgClients(orgId).find((c) => c.deviceId === deviceId)
  }
}

export const presenceTracker = new PresenceTracker()
