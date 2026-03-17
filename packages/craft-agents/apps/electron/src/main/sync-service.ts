/**
 * Sync Service
 *
 * Pushes local profile/group changes to the Web API via SyncClient.
 * Runs a periodic full sync on startup and every SYNC_INTERVAL_MS.
 */

import { randomUUID } from 'node:crypto'
import { hostname, platform, release } from 'node:os'
import {
  getDefaultConnectionManager,
  getProfile,
  getRunningProfiles,
  listGroups,
  listProfiles,
  loadCookiesFromProfile,
  profileHasCookies,
} from '@craft-agent/shared/browser-profiles'
import type { BrowserProfileConfig } from '@craft-agent/shared/browser-profiles/types'
import { SyncClient } from '@craft-agent/shared/sync/client'
import {
  SYNC_INTERVAL_MS,
  WS_PING_INTERVAL_MS,
} from '@craft-agent/shared/sync/constants'
import type { ServerMessage } from '@craft-agent/shared/sync/types'
import { WsClient } from '@craft-agent/shared/sync/ws-client'
import { getLoginSessionByToken } from '@craft-agent/shared/team'
import { app } from 'electron'
import { ipcLog } from './logger'
import { getCurrentSessionToken } from './team'

let syncClient: SyncClient | null = null
let syncTimer: ReturnType<typeof setInterval> | null = null
let wsClient: WsClient | null = null
let heartbeatTimer: ReturnType<typeof setInterval> | null = null
let _lastSyncTime = 0
const startedAt = Date.now()
const deviceId = `electron-${hostname()}-${randomUUID().slice(0, 8)}`

function getOrgId(): string | null {
  // SYNC_ORG_ID overrides: use the web org ID for syncing
  if (process.env.SYNC_ORG_ID) return process.env.SYNC_ORG_ID

  const token = getCurrentSessionToken()
  if (!token) return null
  const session = getLoginSessionByToken(token)
  if (!session) return null
  return session.organizationId
}

function mapProfileToDbRecord(profile: BrowserProfileConfig, orgId: string) {
  return {
    id: profile.id,
    organizationId: orgId,
    name: profile.name,
    platform: profile.platform || 'other',
    browserEngine: profile.browserEngine || null,
    groupId: profile.groupId || null,
    proxyId: profile.proxyId || null,
    tags: profile.tags || [],
    notes: profile.description || '',
    config: {
      startupUrl: profile.startupUrl,
      mcp: profile.mcp,
      status: profile.status,
      lastLaunchedAt: profile.lastLaunchedAt,
    },
    fingerprint: profile.fingerprint,
    version: 1,
    createdAt: new Date(profile.createdAt),
    updatedAt: new Date(profile.updatedAt),
  }
}

function initClient(): SyncClient | null {
  const serverUrl = process.env.SYNC_SERVER_URL || 'http://localhost:3000'
  const apiKey = process.env.SYNC_API_KEY
  if (!apiKey) {
    ipcLog.warn('SYNC_API_KEY not set, sync disabled')
    return null
  }

  const orgId = getOrgId()
  if (!orgId) {
    ipcLog.warn('No organization found, sync deferred')
    return null
  }

  return new SyncClient(serverUrl, apiKey, orgId)
}

export async function pushProfiles(
  profiles: BrowserProfileConfig[],
  deletedIds: string[] = [],
): Promise<void> {
  if (!syncClient) {
    syncClient = initClient()
    if (!syncClient) return
  }

  const orgId = getOrgId()
  if (!orgId) return

  try {
    const upsert = profiles.map((p) => mapProfileToDbRecord(p, orgId))
    await syncClient.push({
      deviceId,
      changes: {
        profiles: {
          upsert,
          delete: deletedIds,
        },
      },
    })
    ipcLog.info(
      `Synced ${upsert.length} profiles, ${deletedIds.length} deletions`,
    )
  } catch (error) {
    ipcLog.error('Sync push failed:', error)
  }
}

export async function uploadProfileCookies(profileId: string): Promise<void> {
  if (!profileHasCookies(profileId)) return

  const serverUrl = process.env.SYNC_SERVER_URL || 'http://localhost:3000'
  const apiKey = process.env.SYNC_API_KEY
  if (!apiKey) return

  const orgId = getOrgId()
  if (!orgId) return

  try {
    const cookies = loadCookiesFromProfile(profileId)
    if (cookies.length === 0) return

    const res = await fetch(
      `${serverUrl}/api/v1/profiles/${profileId}/cookies?orgId=${orgId}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(cookies),
      },
    )

    if (res.ok) {
      ipcLog.info(`Uploaded ${cookies.length} cookies for profile ${profileId}`)
    } else {
      ipcLog.warn(`Cookie upload failed for ${profileId}: ${res.status}`)
    }
  } catch (error) {
    ipcLog.error(`Cookie upload error for ${profileId}:`, error)
  }
}

export async function pushSingleProfile(
  profile: BrowserProfileConfig,
): Promise<void> {
  await pushProfiles([profile])
  await uploadProfileCookies(profile.id)
}

export async function pushDeleteProfile(profileId: string): Promise<void> {
  await pushProfiles([], [profileId])
}

async function fullSync(): Promise<void> {
  if (!syncClient) {
    syncClient = initClient()
    if (!syncClient) return
  }

  const orgId = getOrgId()
  if (!orgId) return

  try {
    const profiles = listProfiles()
    const groups = listGroups()

    const profileRecords = profiles.map((p) => mapProfileToDbRecord(p, orgId))
    const groupRecords = groups.map((g) => ({
      id: g.id,
      organizationId: orgId,
      name: g.name,
      color: g.color || null,
      description: g.description || null,
    }))

    await syncClient.push({
      deviceId,
      changes: {
        profiles: { upsert: profileRecords, delete: [] },
        groups: { upsert: groupRecords, delete: [] },
      },
    })

    // Upload cookies for profiles that have them
    const cookieProfiles = profiles.filter((p) => profileHasCookies(p.id))
    for (const p of cookieProfiles) {
      await uploadProfileCookies(p.id)
    }

    _lastSyncTime = Date.now()
    ipcLog.info(
      `Full sync completed: ${profileRecords.length} profiles, ${groupRecords.length} groups, ${cookieProfiles.length} cookie uploads`,
    )
  } catch (error) {
    ipcLog.error('Full sync failed:', error)
  }
}

const TOOLS_NEEDING_TAB_ID = new Set([
  'browser_get_screenshot',
  'browser_get_screenshot_pointer',
  'browser_get_page_content',
  'browser_get_interactive_elements',
  'browser_grep_interactive_elements',
  'browser_get_load_status',
  'browser_execute_javascript',
])

async function resolveActiveTabId(
  manager: ReturnType<typeof getDefaultConnectionManager>,
  profileId: string,
): Promise<number | undefined> {
  try {
    const result = (await manager.callTool(
      profileId,
      'browser_get_active_tab',
      {},
    )) as {
      content?: { text?: string }[]
    }
    const text = result?.content?.[0]?.text || ''
    const match = text.match(/Tab ID:\s*(\d+)/)
    return match ? parseInt(match[1], 10) : undefined
  } catch {
    return undefined
  }
}

async function handleMcpCall(
  requestId: string,
  profileId: string,
  toolName: string,
  args: Record<string, unknown>,
): Promise<void> {
  try {
    const manager = getDefaultConnectionManager()
    const client = manager.getClient(profileId)

    if (!client) {
      const profile = getProfile(profileId)
      if (!profile) throw new Error('Profile not found')
      const connected = await manager.connect(profile, {
        waitForServer: true,
        timeout: 10_000,
      })
      if (!connected) throw new Error('MCP connection failed')
    }

    // Auto-resolve tabId for tools that need it
    if (TOOLS_NEEDING_TAB_ID.has(toolName) && !args.tabId) {
      const tabId = await resolveActiveTabId(manager, profileId)
      if (tabId) args.tabId = tabId
    }

    // Auto-fill required 'type' param for page content
    if (toolName === 'browser_get_page_content' && !args.type) {
      args.type = 'text'
    }

    const result = await manager.callTool(profileId, toolName, args)
    wsClient?.send({
      type: 'mcp.result',
      requestId,
      success: true,
      data: result,
    })
  } catch (err) {
    wsClient?.send({
      type: 'mcp.result',
      requestId,
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    })
  }
}

function connectWebSocket(): void {
  const apiKey = process.env.SYNC_API_KEY
  if (!apiKey) return

  const wsUrl = process.env.SYNC_WS_URL || 'ws://localhost:3001'
  wsClient = new WsClient(
    `${wsUrl}?deviceId=${encodeURIComponent(deviceId)}`,
    apiKey,
  )

  wsClient.onMessage((msg: ServerMessage) => {
    if (msg.type === 'presence') {
      ipcLog.info(`Presence update: ${msg.members.length} members online`)
    } else if (msg.type === 'mcp.call') {
      handleMcpCall(msg.requestId, msg.profileId, msg.toolName, msg.args).catch(
        (err) => ipcLog.error('MCP call handler error:', err),
      )
    }
  })

  wsClient.connect()

  // Send device info after connection establishes
  setTimeout(() => {
    sendDeviceInfo()
  }, 1000)

  // Periodic heartbeat
  heartbeatTimer = setInterval(() => {
    sendHeartbeat()
  }, WS_PING_INTERVAL_MS)

  ipcLog.info('WebSocket client connected')
}

function sendDeviceInfo(): void {
  if (!wsClient) return
  const osName =
    platform() === 'darwin'
      ? 'macOS'
      : platform() === 'win32'
        ? 'Windows'
        : 'Linux'
  wsClient.send({
    type: 'device.info',
    hostname: hostname(),
    os: `${osName} ${release()}`,
    appVersion: app.getVersion(),
    runningProfiles: getRunningProfiles(),
  })
}

export function sendHeartbeat(): void {
  if (!wsClient) return
  wsClient.send({
    type: 'device.heartbeat',
    runningProfiles: getRunningProfiles(),
    uptime: Math.floor((Date.now() - startedAt) / 1000),
  })
}

export async function startSyncService(): Promise<void> {
  syncClient = initClient()
  if (!syncClient) return

  await fullSync()

  syncTimer = setInterval(() => {
    fullSync().catch((err) => {
      ipcLog.error('Periodic sync failed:', err)
    })
  }, SYNC_INTERVAL_MS)

  connectWebSocket()

  ipcLog.info(`Sync service started (interval: ${SYNC_INTERVAL_MS / 1000}s)`)
}

export function stopSyncService(): void {
  if (syncTimer) {
    clearInterval(syncTimer)
    syncTimer = null
  }
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer)
    heartbeatTimer = null
  }
  if (wsClient) {
    wsClient.disconnect()
    wsClient = null
  }
  syncClient = null
  ipcLog.info('Sync service stopped')
}
