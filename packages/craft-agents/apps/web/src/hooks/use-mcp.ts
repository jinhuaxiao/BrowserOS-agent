'use client'

import type { ServerMessage } from '@craft-agent/shared/sync/types'
import type { RefObject } from 'react'
import { useCallback, useEffect, useRef } from 'react'
import type { MessageHandler } from './use-presence'

export interface McpResult {
  success: boolean
  data?: unknown
  error?: string
}

interface PendingCall {
  resolve: (result: McpResult) => void
  timer: ReturnType<typeof setTimeout>
}

const MCP_CALL_TIMEOUT = 30_000

export function useMcpCall(
  wsRef: RefObject<WebSocket | null>,
  registerHandler: (handler: MessageHandler) => () => void,
) {
  const pendingCalls = useRef<Map<string, PendingCall>>(new Map())

  useEffect(() => {
    const unregister = registerHandler((msg: ServerMessage) => {
      if (msg.type === 'mcp.result') {
        const pending = pendingCalls.current.get(msg.requestId)
        if (pending) {
          clearTimeout(pending.timer)
          pendingCalls.current.delete(msg.requestId)
          pending.resolve({
            success: msg.success,
            data: msg.data,
            error: msg.error,
          })
        }
      }
    })
    return unregister
  }, [registerHandler])

  const callTool = useCallback(
    (
      targetDeviceId: string,
      profileId: string,
      toolName: string,
      args: Record<string, unknown> = {},
    ): Promise<McpResult> => {
      const ws = wsRef.current
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        return Promise.resolve({
          success: false,
          error: 'WebSocket not connected',
        })
      }

      const requestId = crypto.randomUUID()

      return new Promise((resolve) => {
        const timer = setTimeout(() => {
          pendingCalls.current.delete(requestId)
          resolve({ success: false, error: 'Request timed out' })
        }, MCP_CALL_TIMEOUT)

        pendingCalls.current.set(requestId, { resolve, timer })

        ws.send(
          JSON.stringify({
            type: 'mcp.call',
            requestId,
            targetDeviceId,
            profileId,
            toolName,
            args,
          }),
        )
      })
    },
    [wsRef],
  )

  return { callTool }
}
