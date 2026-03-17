/**
 * Lightweight Sync Agent
 *
 * Scans local MCP servers to discover running profiles,
 * connects to ws-server and reports them as an Electron device.
 * Handles mcp.call requests by forwarding to local MCP servers.
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
        running.push({ profileId: dir, port })
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

  const profilePortMap = new Map<string, number>()
  for (const p of runningProfiles) {
    profilePortMap.set(p.profileId, p.port)
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
        const port = profilePortMap.get(profileId)

        if (!port) {
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
          console.log(`MCP call: ${toolName} → ${profileId} (port ${port})`)
          const result = await callLocalMcp(port, toolName, args || {})
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
    } catch {}
  }

  ws.onclose = () => {
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
        profilePortMap.set(p.profileId, p.port)
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
