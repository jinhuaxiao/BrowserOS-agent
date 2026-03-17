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

export type ServerMessage =
  | { type: 'presence'; members: PresenceInfo[] }
  | { type: 'sync'; entity: string; action: 'upsert' | 'delete'; data: unknown }
  | { type: 'notification'; title: string; body: string }
  | { type: 'profile.locked'; profileId: string; userId: string }
  | { type: 'profile.unlocked'; profileId: string }
  | { type: 'pong' }

export type ClientMessage =
  | { type: 'ping' }
  | { type: 'profile.lock'; profileId: string }
  | { type: 'profile.unlock'; profileId: string }

export interface PresenceInfo {
  userId: string
  orgId: string
  deviceId: string
  connectedAt: number
}
