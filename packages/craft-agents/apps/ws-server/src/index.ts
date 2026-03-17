import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { presenceTracker } from './presence'
import { handleWebSocket, type WsContext } from './ws-handler'

const app = new Hono()

app.use('*', cors())

app.get('/health', (c) => c.json({ status: 'ok' }))

const port = parseInt(process.env.WS_PORT || '3001')

const server = Bun.serve({
  port,
  fetch: app.fetch,
  websocket: {
    open(ws) {
      const ctx = ws.data as WsContext
      presenceTracker.addClient(ctx)
    },
    message(ws, message) {
      handleWebSocket(ws, message)
    },
    close(ws) {
      const ctx = ws.data as WsContext
      presenceTracker.removeClient(ctx)
    },
  },
})

console.log(`WebSocket server running on port ${port}`)
