export interface SyncPullResponse {
  serverTime: number
  profiles: { upserted: unknown[]; deleted: string[] }
  members: { upserted: unknown[]; deleted: string[] }
  groups: { upserted: unknown[]; deleted: string[] }
  proxies: { upserted: unknown[]; deleted: string[] }
  assignments: { upserted: unknown[]; deleted: string[] }
}

export interface SyncPushRequest {
  deviceId: string
  changes: {
    profiles?: { upsert: unknown[]; delete: string[] }
    groups?: { upsert: unknown[]; delete: string[] }
  }
}

export interface SyncPushResponse {
  ok: boolean
  serverTime: number
}

export interface ScreencastFrameMetadata {
  timestamp: number
  pageScaleFactor: number
  offsetTop: number
  deviceWidth: number
  deviceHeight: number
}

export type ServerMessage =
  | { type: 'presence'; members: PresenceInfo[] }
  | { type: 'sync'; entity: string; action: 'upsert' | 'delete'; data: unknown }
  | { type: 'notification'; title: string; body: string }
  | { type: 'profile.locked'; profileId: string; userId: string }
  | { type: 'profile.unlocked'; profileId: string }
  | { type: 'pong' }
  | {
      type: 'mcp.call'
      requestId: string
      profileId: string
      toolName: string
      args: Record<string, unknown>
    }
  | {
      type: 'mcp.result'
      requestId: string
      success: boolean
      data?: unknown
      error?: string
    }
  | { type: 'screencast.started'; requestId: string; profileId: string }
  | {
      type: 'screencast.frame'
      profileId: string
      data: string
      sessionId: number
      metadata: ScreencastFrameMetadata
    }
  | { type: 'screencast.stopped'; profileId: string }
  | {
      type: 'screencast.error'
      requestId: string
      profileId: string
      error: string
    }

export type ClientMessage =
  | { type: 'ping' }
  | { type: 'profile.lock'; profileId: string }
  | { type: 'profile.unlock'; profileId: string }
  | {
      type: 'device.info'
      hostname: string
      os: string
      appVersion: string
      runningProfiles: string[]
    }
  | { type: 'device.heartbeat'; runningProfiles: string[]; uptime: number }
  | {
      type: 'mcp.call'
      requestId: string
      targetDeviceId: string
      profileId: string
      toolName: string
      args: Record<string, unknown>
    }
  | {
      type: 'mcp.result'
      requestId: string
      success: boolean
      data?: unknown
      error?: string
    }
  | {
      type: 'screencast.start'
      requestId: string
      targetDeviceId: string
      profileId: string
      options?: {
        maxWidth?: number
        maxHeight?: number
        quality?: number
        everyNthFrame?: number
      }
    }
  | { type: 'screencast.stop'; targetDeviceId: string; profileId: string }
  | {
      type: 'screencast.ack'
      targetDeviceId: string
      profileId: string
      sessionId: number
    }

export interface PresenceInfo {
  userId: string
  orgId: string
  deviceId: string
  connectedAt: number
  hostname?: string
  os?: string
  appVersion?: string
  runningProfiles?: string[]
  lastHeartbeatAt?: number
}
