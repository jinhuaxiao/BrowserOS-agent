import {
  WS_MAX_RECONNECT_DELAY_MS,
  WS_PING_INTERVAL_MS,
  WS_RECONNECT_DELAY_MS,
} from './constants'
import type { ClientMessage, ServerMessage } from './types'

export type MessageHandler = (message: ServerMessage) => void

export class WsClient {
  private url: string
  private token: string
  private ws: WebSocket | null = null
  private reconnectDelay = WS_RECONNECT_DELAY_MS
  private pingInterval: ReturnType<typeof setInterval> | null = null
  private handlers: MessageHandler[] = []
  private closed = false

  constructor(url: string, token: string) {
    this.url = url
    this.token = token
  }

  connect() {
    this.closed = false
    this.ws = new WebSocket(`${this.url}?token=${this.token}`)

    this.ws.onopen = () => {
      this.reconnectDelay = WS_RECONNECT_DELAY_MS
      this.startPing()
    }

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data as string) as ServerMessage
        for (const handler of this.handlers) {
          handler(message)
        }
      } catch {}
    }

    this.ws.onclose = () => {
      this.stopPing()
      if (!this.closed) {
        setTimeout(() => this.connect(), this.reconnectDelay)
        this.reconnectDelay = Math.min(
          this.reconnectDelay * 2,
          WS_MAX_RECONNECT_DELAY_MS,
        )
      }
    }

    this.ws.onerror = () => {
      this.ws?.close()
    }
  }

  disconnect() {
    this.closed = true
    this.stopPing()
    this.ws?.close()
    this.ws = null
  }

  send(message: ClientMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message))
    }
  }

  onMessage(handler: MessageHandler) {
    this.handlers.push(handler)
    return () => {
      this.handlers = this.handlers.filter((h) => h !== handler)
    }
  }

  private startPing() {
    this.pingInterval = setInterval(() => {
      this.send({ type: 'ping' })
    }, WS_PING_INTERVAL_MS)
  }

  private stopPing() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval)
      this.pingInterval = null
    }
  }
}
