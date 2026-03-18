/**
 * Lightweight Sync Agent
 *
 * Scans local MCP servers to discover running profiles,
 * connects to ws-server and reports them as an Electron device.
 * Handles mcp.call requests by forwarding to local MCP servers.
 * Handles screencast requests by connecting to CDP and streaming frames.
 */

import { existsSync, lstatSync, readdirSync, readFileSync } from 'node:fs'
import { homedir, hostname } from 'node:os'
import { join } from 'node:path'

const WS_URL = process.env.SYNC_WS_URL || 'ws://localhost:3001'
const API_KEY = process.env.SYNC_API_KEY || ''
const DEVICE_ID = `electron-${hostname()}-agent`
const PROFILES_DIR = join(homedir(), '.craft-agent', 'browser-profiles')
const SCAN_INTERVAL = 10_000
const HEARTBEAT_INTERVAL = 30_000

interface ProfileMcp {
  profileId: string
  port: number
  cdpPort?: number
}

interface ScreencastSession {
  cdpWs: WebSocket
  profileId: string
  cdpMsgId: number
  cdpPort: number
  serverWs: WebSocket
  options?: {
    maxWidth?: number
    maxHeight?: number
    quality?: number
    everyNthFrame?: number
  }
  reconnecting?: boolean
}

const activeScreencasts = new Map<string, ScreencastSession>()

async function probeCdpPort(configPort: number): Promise<number | null> {
  // Try the configured port first, then nearby ports (config can be off by 1)
  for (const port of [configPort, configPort - 1, configPort + 1]) {
    try {
      const res = await fetch(`http://localhost:${port}/json/version`, {
        signal: AbortSignal.timeout(500),
      })
      if (res.ok) return port
    } catch {}
  }
  return null
}

async function scanRunningProfiles(): Promise<ProfileMcp[]> {
  const running: ProfileMcp[] = []

  if (!existsSync(PROFILES_DIR)) return running

  for (const dir of readdirSync(PROFILES_DIR)) {
    const userDataDir = join(PROFILES_DIR, dir, 'user-data')

    // Chrome creates SingletonLock while the browser is running
    const lockPath = join(userDataDir, 'SingletonLock')
    if (
      !existsSync(lockPath) &&
      !lstatSync(lockPath, { throwIfNoEntry: false })
    )
      continue

    const configPath = join(userDataDir, '.browseros', 'server_config.json')
    if (!existsSync(configPath)) continue

    try {
      const config = JSON.parse(readFileSync(configPath, 'utf-8'))
      const port = config.ports?.http_mcp
      if (!port) continue

      // Verify MCP server is actually responding
      const res = await fetch(`http://127.0.0.1:${port}/health`, {
        signal: AbortSignal.timeout(500),
      })
      if (res.ok) {
        // Probe actual CDP port (server_config may be stale)
        let cdpPort = config.ports?.cdp as number | undefined
        if (cdpPort) {
          const actualCdp = await probeCdpPort(cdpPort)
          if (actualCdp) {
            cdpPort = actualCdp
          }
        }
        running.push({
          profileId: dir,
          port,
          cdpPort,
        })
      }
    } catch {}
  }

  return running
}

// MCP client for forwarding calls
async function callLocalMcp(
  port: number,
  toolName: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  // Use StreamableHTTP MCP protocol
  const { Client } = await import('@modelcontextprotocol/sdk/client/index.js')
  const { StreamableHTTPClientTransport } = await import(
    '@modelcontextprotocol/sdk/client/streamableHttp.js'
  )

  const client = new Client({ name: 'sync-agent', version: '1.0.0' })
  const transport = new StreamableHTTPClientTransport(
    new URL(`http://127.0.0.1:${port}/mcp`),
  )

  await client.connect(transport)

  // Auto-resolve tabId if needed
  const needsTabId = [
    'browser_get_screenshot',
    'browser_get_screenshot_pointer',
    'browser_get_page_content',
    'browser_get_interactive_elements',
    'browser_grep_interactive_elements',
    'browser_get_load_status',
    'browser_execute_javascript',
  ]

  if (needsTabId.includes(toolName) && !args.tabId) {
    const tabResult = await client.callTool({
      name: 'browser_get_active_tab',
      arguments: {},
    })
    const tabText =
      (tabResult.content as { type: string; text: string }[])?.[0]?.text || ''
    const match = tabText.match(/Tab ID:\s*(\d+)/)
    if (match) args.tabId = parseInt(match[1], 10)
  }

  if (toolName === 'browser_get_page_content' && !args.type) {
    args.type = 'text'
  }

  const result = await client.callTool({ name: toolName, arguments: args })
  await client.close()
  return result
}

async function getCdpWebSocketUrl(cdpPort: number): Promise<string> {
  // /json/list returns targets ordered by most recently active first
  try {
    const pagesRes = await fetch(`http://localhost:${cdpPort}/json/list`, {
      signal: AbortSignal.timeout(2000),
    })
    const pages = (await pagesRes.json()) as {
      webSocketDebuggerUrl?: string
      type?: string
      url?: string
    }[]
    // First real http page is typically the active tab
    const page =
      pages.find(
        (p) =>
          p.type === 'page' &&
          p.webSocketDebuggerUrl &&
          p.url?.startsWith('http'),
      ) || pages.find((p) => p.type === 'page' && p.webSocketDebuggerUrl)
    if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl
  } catch {}

  // Fall back to browser-level endpoint
  const res = await fetch(`http://localhost:${cdpPort}/json/version`, {
    signal: AbortSignal.timeout(2000),
  })
  const info = (await res.json()) as { webSocketDebuggerUrl?: string }
  if (!info.webSocketDebuggerUrl) {
    throw new Error(`No CDP WebSocket endpoint on port ${cdpPort}`)
  }
  return info.webSocketDebuggerUrl
}

function connectScreencastToPage(
  session: ScreencastSession,
  wsUrl: string,
  requestId?: string,
) {
  const { profileId, serverWs, options } = session

  // Close old CDP ws if any
  try {
    session.cdpWs?.close()
  } catch {}

  const cdpWs = new WebSocket(wsUrl)
  session.cdpWs = cdpWs
  session.reconnecting = false

  cdpWs.onopen = () => {
    // Enable Page domain (required for screencast)
    cdpWs.send(
      JSON.stringify({
        id: session.cdpMsgId++,
        method: 'Page.enable',
        params: {},
      }),
    )
    // Start screencast
    cdpWs.send(
      JSON.stringify({
        id: session.cdpMsgId++,
        method: 'Page.startScreencast',
        params: {
          format: 'jpeg',
          quality: options?.quality ?? 60,
          maxWidth: options?.maxWidth ?? 1366,
          maxHeight: options?.maxHeight ?? 768,
          everyNthFrame: options?.everyNthFrame ?? 1,
        },
      }),
    )
    console.log(
      `Screencast connected: ${profileId} → ${wsUrl.split('/').pop()}`,
    )
    if (requestId) {
      serverWs.send(
        JSON.stringify({ type: 'screencast.started', requestId, profileId }),
      )
    }
  }

  cdpWs.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data as string)

      if (msg.method === 'Page.screencastFrame') {
        const { data, metadata, sessionId } = msg.params

        // Immediately ack to CDP so next frame is sent (don't wait for web round-trip)
        cdpWs.send(
          JSON.stringify({
            id: session.cdpMsgId++,
            method: 'Page.screencastFrameAck',
            params: { sessionId },
          }),
        )

        serverWs.send(
          JSON.stringify({
            type: 'screencast.frame',
            profileId,
            data,
            sessionId,
            metadata,
          }),
        )
      }

      // Tab switched — reconnect screencast to the new active page
      if (
        msg.method === 'Page.screencastVisibilityChanged' &&
        !msg.params.visible
      ) {
        if (!session.reconnecting) {
          session.reconnecting = true
          console.log(`Screencast: tab switched, reconnecting ${profileId}...`)
          setTimeout(() => reconnectScreencast(session), 300)
        }
      }
    } catch {}
  }

  cdpWs.onclose = () => {
    const current = activeScreencasts.get(profileId)
    if (current?.cdpWs === cdpWs && !current.reconnecting) {
      activeScreencasts.delete(profileId)
      console.log(`Screencast CDP disconnected: ${profileId}`)
      serverWs.send(JSON.stringify({ type: 'screencast.stopped', profileId }))
    }
  }

  cdpWs.onerror = () => {
    cdpWs.close()
  }
}

async function reconnectScreencast(session: ScreencastSession) {
  const { profileId, cdpPort } = session
  try {
    // Stop screencast on old page
    try {
      session.cdpWs.send(
        JSON.stringify({
          id: session.cdpMsgId++,
          method: 'Page.stopScreencast',
          params: {},
        }),
      )
      session.cdpWs.close()
    } catch {}

    // Get the new active page
    const wsUrl = await getCdpWebSocketUrl(cdpPort)
    connectScreencastToPage(session, wsUrl)
  } catch (err) {
    console.log(
      `Screencast reconnect failed for ${profileId}: ${(err as Error).message}`,
    )
    activeScreencasts.delete(profileId)
    session.serverWs.send(
      JSON.stringify({ type: 'screencast.stopped', profileId }),
    )
  }
}

function startScreencast(
  serverWs: WebSocket,
  profileId: string,
  cdpPort: number,
  requestId: string,
  options?: {
    maxWidth?: number
    maxHeight?: number
    quality?: number
    everyNthFrame?: number
  },
) {
  // Stop existing screencast for this profile
  stopScreencast(profileId)

  getCdpWebSocketUrl(cdpPort)
    .then((wsUrl) => {
      const session: ScreencastSession = {
        cdpWs: null as unknown as WebSocket,
        profileId,
        cdpMsgId: 1,
        cdpPort,
        serverWs,
        options,
      }
      activeScreencasts.set(profileId, session)
      connectScreencastToPage(session, wsUrl, requestId)
    })
    .catch((err) => {
      console.log(
        `Screencast error for ${profileId}: ${(err as Error).message}`,
      )
      serverWs.send(
        JSON.stringify({
          type: 'screencast.error',
          requestId,
          profileId,
          error: (err as Error).message,
        }),
      )
    })
}

function stopScreencast(profileId: string) {
  const session = activeScreencasts.get(profileId)
  if (!session) return

  try {
    const id = session.cdpMsgId++
    session.cdpWs.send(
      JSON.stringify({ id, method: 'Page.stopScreencast', params: {} }),
    )
    session.cdpWs.close()
  } catch {}

  activeScreencasts.delete(profileId)
  console.log(`Screencast stopped: ${profileId}`)
}

function ackScreencastFrame(profileId: string, sessionId: number) {
  const session = activeScreencasts.get(profileId)
  if (!session) return

  try {
    const id = session.cdpMsgId++
    session.cdpWs.send(
      JSON.stringify({
        id,
        method: 'Page.screencastFrameAck',
        params: { sessionId },
      }),
    )
  } catch {}
}

async function main() {
  if (!API_KEY) {
    console.error('SYNC_API_KEY is required')
    process.exit(1)
  }

  console.log(`Sync Agent starting (device: ${DEVICE_ID})`)

  let runningProfiles = await scanRunningProfiles()
  console.log(
    `Found ${runningProfiles.length} running profiles: ${runningProfiles.map((p) => p.profileId).join(', ')}`,
  )

  const profilePortMap = new Map<string, { mcp: number; cdp?: number }>()
  for (const p of runningProfiles) {
    profilePortMap.set(p.profileId, { mcp: p.port, cdp: p.cdpPort })
  }

  const ws = new WebSocket(
    `${WS_URL}?token=${API_KEY}&deviceId=${encodeURIComponent(DEVICE_ID)}`,
  )

  ws.onopen = () => {
    console.log('Connected to ws-server')

    // Send device info
    ws.send(
      JSON.stringify({
        type: 'device.info',
        hostname: hostname(),
        os: `${process.platform === 'darwin' ? 'macOS' : process.platform}`,
        appVersion: '1.0.0-agent',
        runningProfiles: runningProfiles.map((p) => p.profileId),
      }),
    )
  }

  ws.onmessage = async (event) => {
    try {
      const msg = JSON.parse(event.data as string)

      if (msg.type === 'mcp.call') {
        const { requestId, profileId, toolName, args } = msg
        const ports = profilePortMap.get(profileId)

        if (!ports) {
          ws.send(
            JSON.stringify({
              type: 'mcp.result',
              requestId,
              success: false,
              error: 'Profile MCP port not found',
            }),
          )
          return
        }

        try {
          console.log(
            `MCP call: ${toolName} → ${profileId} (port ${ports.mcp})`,
          )
          const result = await callLocalMcp(ports.mcp, toolName, args || {})
          ws.send(
            JSON.stringify({
              type: 'mcp.result',
              requestId,
              success: true,
              data: result,
            }),
          )
          console.log(`MCP result: ${toolName} → success`)
        } catch (err) {
          ws.send(
            JSON.stringify({
              type: 'mcp.result',
              requestId,
              success: false,
              error: (err as Error).message,
            }),
          )
          console.log(
            `MCP result: ${toolName} → error: ${(err as Error).message}`,
          )
        }
      }

      if (msg.type === 'screencast.start') {
        const { requestId, profileId, options } = msg
        const ports = profilePortMap.get(profileId)

        if (!ports?.cdp) {
          ws.send(
            JSON.stringify({
              type: 'screencast.error',
              requestId,
              profileId,
              error: 'Profile CDP port not found',
            }),
          )
          return
        }

        startScreencast(ws, profileId, ports.cdp, requestId, options)
      }

      if (msg.type === 'screencast.stop') {
        stopScreencast(msg.profileId)
        ws.send(
          JSON.stringify({
            type: 'screencast.stopped',
            profileId: msg.profileId,
          }),
        )
      }

      if (msg.type === 'screencast.ack') {
        ackScreencastFrame(msg.profileId, msg.sessionId)
      }
    } catch {}
  }

  ws.onclose = () => {
    // Stop all active screencasts on disconnect
    for (const profileId of activeScreencasts.keys()) {
      stopScreencast(profileId)
    }
    console.log('Disconnected from ws-server, exiting')
    process.exit(0)
  }

  // Periodic scan for profile changes
  setInterval(async () => {
    const newProfiles = await scanRunningProfiles()
    const newIds = newProfiles
      .map((p) => p.profileId)
      .sort()
      .join(',')
    const oldIds = runningProfiles
      .map((p) => p.profileId)
      .sort()
      .join(',')

    if (newIds !== oldIds) {
      runningProfiles = newProfiles
      profilePortMap.clear()
      for (const p of newProfiles) {
        profilePortMap.set(p.profileId, { mcp: p.port, cdp: p.cdpPort })
      }

      // Stop screencasts for profiles that are no longer running
      for (const profileId of activeScreencasts.keys()) {
        if (!profilePortMap.has(profileId)) {
          stopScreencast(profileId)
        }
      }

      console.log(`Profile change: ${newProfiles.length} running`)

      ws.send(
        JSON.stringify({
          type: 'device.heartbeat',
          runningProfiles: newProfiles.map((p) => p.profileId),
          uptime: Math.floor(process.uptime()),
        }),
      )
    }
  }, SCAN_INTERVAL)

  // Heartbeat
  setInterval(() => {
    ws.send(
      JSON.stringify({
        type: 'device.heartbeat',
        runningProfiles: runningProfiles.map((p) => p.profileId),
        uptime: Math.floor(process.uptime()),
      }),
    )
  }, HEARTBEAT_INTERVAL)
}

main().catch(console.error)
