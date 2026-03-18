'use client'

import type { ServerMessage } from '@craft-agent/shared/sync/types'
import type { RefObject } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { MessageHandler } from './use-presence'

interface ScreencastState {
  deviceId: string
  profileId: string
}

export function useScreencast(
  wsRef: RefObject<WebSocket | null>,
  registerHandler: (handler: MessageHandler) => () => void,
) {
  const [isStreaming, setIsStreaming] = useState(false)
  const [currentFrame, setCurrentFrame] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fps, setFps] = useState(0)
  const activeRef = useRef<ScreencastState | null>(null)
  const frameTimesRef = useRef<number[]>([])

  useEffect(() => {
    const unregister = registerHandler((msg: ServerMessage) => {
      if (msg.type === 'screencast.started') {
        setIsStreaming(true)
        setError(null)
        frameTimesRef.current = []
      }

      if (msg.type === 'screencast.frame') {
        setCurrentFrame(msg.data)

        // Calculate FPS
        const now = Date.now()
        frameTimesRef.current.push(now)
        const cutoff = now - 1000
        frameTimesRef.current = frameTimesRef.current.filter((t) => t > cutoff)
        setFps(frameTimesRef.current.length)

        // Send ack
        const ws = wsRef.current
        const active = activeRef.current
        if (ws && ws.readyState === WebSocket.OPEN && active) {
          ws.send(
            JSON.stringify({
              type: 'screencast.ack',
              targetDeviceId: active.deviceId,
              profileId: active.profileId,
              sessionId: msg.sessionId,
            }),
          )
        }
      }

      if (msg.type === 'screencast.stopped') {
        setIsStreaming(false)
        activeRef.current = null
        frameTimesRef.current = []
        setFps(0)
      }

      if (msg.type === 'screencast.error') {
        setError(msg.error)
        setIsStreaming(false)
        activeRef.current = null
      }
    })
    return unregister
  }, [registerHandler, wsRef])

  const startScreencast = useCallback(
    (
      deviceId: string,
      profileId: string,
      options?: {
        maxWidth?: number
        maxHeight?: number
        quality?: number
        everyNthFrame?: number
      },
    ) => {
      const ws = wsRef.current
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        setError('WebSocket not connected')
        return
      }

      activeRef.current = { deviceId, profileId }
      setError(null)
      setCurrentFrame(null)

      ws.send(
        JSON.stringify({
          type: 'screencast.start',
          requestId: crypto.randomUUID(),
          targetDeviceId: deviceId,
          profileId,
          options,
        }),
      )
    },
    [wsRef],
  )

  const stopScreencast = useCallback(() => {
    const ws = wsRef.current
    const active = activeRef.current
    if (!ws || !active || ws.readyState !== WebSocket.OPEN) return

    ws.send(
      JSON.stringify({
        type: 'screencast.stop',
        targetDeviceId: active.deviceId,
        profileId: active.profileId,
      }),
    )

    setIsStreaming(false)
    setCurrentFrame(null)
    activeRef.current = null
    frameTimesRef.current = []
    setFps(0)
  }, [wsRef])

  return {
    startScreencast,
    stopScreencast,
    isStreaming,
    currentFrame,
    fps,
    error,
  }
}
