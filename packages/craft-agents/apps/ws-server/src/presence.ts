import type { WsContext } from './ws-handler'

interface PresenceInfo {
  userId: string
  orgId: string
  deviceId: string
  connectedAt: number
}

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

  getOrgClients(orgId: string): WsContext[] {
    return Array.from(this.clients.values()).filter((c) => c.orgId === orgId)
  }

  broadcastPresence(orgId: string) {
    const clients = this.getOrgClients(orgId)
    const members: PresenceInfo[] = clients.map((c) => ({
      userId: c.userId,
      orgId: c.orgId,
      deviceId: c.deviceId,
      connectedAt: c.connectedAt,
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
}

export const presenceTracker = new PresenceTracker()
