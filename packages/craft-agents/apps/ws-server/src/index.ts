import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { verifyToken } from './auth'
import { presenceTracker } from './presence'
import {
  cleanupScreencasts,
  handleWebSocket,
  type WsContext,
} from './ws-handler'

const app = new Hono()

app.use('*', cors())

app.get('/health', (c) => c.json({ status: 'ok' }))

const port = parseInt(process.env.WS_PORT || '3001', 10)

const _server = Bun.serve({
  port,
  fetch(req, server) {
    const url = new URL(req.url)

    if (req.headers.get('upgrade')?.toLowerCase() === 'websocket') {
      const token = url.searchParams.get('token')
      if (!token) {
        return new Response('Missing token', { status: 401 })
      }

      return verifyToken(token).then((payload) => {
        if (!payload) {
          return new Response('Invalid token', { status: 401 })
        }

        const wsContext: WsContext = {
          clientId: crypto.randomUUID(),
          userId: payload.userId,
          orgId: payload.orgId || '',
          deviceId: url.searchParams.get('deviceId') || `web-${payload.userId}`,
          connectedAt: Date.now(),
        }

        const upgraded = server.upgrade(req, { data: wsContext })
        if (!upgraded) {
          return new Response('WebSocket upgrade failed', { status: 500 })
        }
        return undefined as unknown as Response
      })
    }

    return app.fetch(req, server)
  },
  websocket: {
    open(ws) {
      const ctx = ws.data as WsContext
      ctx.ws = ws
      presenceTracker.addClient(ctx)
    },
    message(ws, message) {
      handleWebSocket(ws, message)
    },
    close(ws) {
      const ctx = ws.data as WsContext
      cleanupScreencasts(ctx.clientId)
      presenceTracker.removeClient(ctx)
    },
  },
})

console.log(`WebSocket server running on port ${port}`)
