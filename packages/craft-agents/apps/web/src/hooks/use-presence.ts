'use client'

import type {
  PresenceInfo,
  ServerMessage,
} from '@craft-agent/shared/sync/types'
import { useCallback, useEffect, useRef, useState } from 'react'

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001'
const RECONNECT_DELAY = 3000
const MAX_RECONNECT_DELAY = 30000

export type MessageHandler = (msg: ServerMessage) => void

export function usePresence() {
  const [members, setMembers] = useState<PresenceInfo[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectDelayRef = useRef(RECONNECT_DELAY)
  const closedRef = useRef(false)
  const handlersRef = useRef<MessageHandler[]>([])

  const connect = useCallback(async () => {
    if (closedRef.current) return

    try {
      const res = await fetch('/api/v1/ws-token')
      if (!res.ok) return
      const { token } = await res.json()

      const ws = new WebSocket(`${WS_URL}?token=${token}`)
      wsRef.current = ws

      ws.onopen = () => {
        setIsConnected(true)
        reconnectDelayRef.current = RECONNECT_DELAY
      }

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as ServerMessage
          if (msg.type === 'presence') {
            setMembers(msg.members)
          }
          for (const handler of handlersRef.current) {
            handler(msg)
          }
        } catch {}
      }

      ws.onclose = () => {
        setIsConnected(false)
        wsRef.current = null
        if (!closedRef.current) {
          setTimeout(() => connect(), reconnectDelayRef.current)
          reconnectDelayRef.current = Math.min(
            reconnectDelayRef.current * 2,
            MAX_RECONNECT_DELAY,
          )
        }
      }

      ws.onerror = () => {
        ws.close()
      }
    } catch {
      if (!closedRef.current) {
        setTimeout(() => connect(), reconnectDelayRef.current)
      }
    }
  }, [])

  useEffect(() => {
    closedRef.current = false
    connect()

    return () => {
      closedRef.current = true
      wsRef.current?.close()
      wsRef.current = null
    }
  }, [connect])

  const registerHandler = useCallback((handler: MessageHandler) => {
    handlersRef.current.push(handler)
    return () => {
      handlersRef.current = handlersRef.current.filter((h) => h !== handler)
    }
  }, [])

  return { members, isConnected, wsRef, registerHandler }
}
