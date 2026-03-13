import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import { CraftMcpClient } from '../mcp/client.ts'
import { getProfileMcpPort, launchBrowser, stopBrowser } from './launcher.ts'
import { waitForMcpServer } from './mcp-port-discovery.ts'
import { getProfile, listProfiles, updateProfileStatus } from './storage.ts'
import type { BrowserProfileConfig } from './types.ts'

const DEFAULT_HOST = '127.0.0.1'
const DEFAULT_MCP_WAIT_MS = 30_000
const PROBE_TIMEOUT_MS = 750
const RETRY_DELAY_MS = 400

export interface ProfileSelection {
  profile: BrowserProfileConfig
  matchedBy: 'id' | 'name' | 'prefix'
}

export interface ProfileSession {
  profile: BrowserProfileConfig
  host: string
  port: number
  baseUrl: string
  mcpUrl: string
  pid?: number
  pidAlive: boolean
  mcpReady: boolean
  launched: boolean
}

export interface EnsureProfileOptions {
  timeoutMs?: number
}

export interface BrowserToolResult<TStructured = Record<string, unknown>> {
  content?: Array<{
    type: string
    text?: string
    data?: string
    mimeType?: string
  }>
  structuredContent?: TStructured
  isError?: boolean
}

export function getProfileHost(profile: BrowserProfileConfig): string {
  return profile.mcp?.host || DEFAULT_HOST
}

export function buildProfileBaseUrl(
  profile: BrowserProfileConfig,
  port = getProfileMcpPort(profile.id),
): string {
  return `http://${getProfileHost(profile)}:${port}`
}

export function buildProfileMcpUrl(
  profile: BrowserProfileConfig,
  port = getProfileMcpPort(profile.id),
): string {
  return `${buildProfileBaseUrl(profile, port)}/mcp`
}

export function getTextFromToolResult(result: unknown): string {
  const content = isBrowserToolResult(result) ? result.content : undefined
  if (!content?.length) {
    return ''
  }

  return content
    .filter((item) => item.type === 'text' && typeof item.text === 'string')
    .map((item) => item.text ?? '')
    .join('\n')
    .trim()
}

export function getStructuredContentFromToolResult<T>(
  result: unknown,
): T | undefined {
  if (!isBrowserToolResult(result)) {
    return undefined
  }

  return result.structuredContent as T | undefined
}

export function isBrowserToolResult(
  value: unknown,
): value is BrowserToolResult {
  return Boolean(value) && typeof value === 'object'
}

export function isProcessAlive(pid?: number): boolean {
  if (!pid) {
    return false
  }

  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

export function resolveProfileSelection(selector?: string): ProfileSelection {
  const profiles = listProfiles()

  if (profiles.length === 0) {
    throw new Error('No browser profiles found')
  }

  if (!selector) {
    if (profiles.length === 1) {
      return { profile: profiles[0], matchedBy: 'id' }
    }

    throw new Error(
      'Profile is required. Pass --profile <profileId>. Available profiles: ' +
        profiles.map((profile) => `${profile.name} (${profile.id})`).join(', '),
    )
  }

  const exactId = profiles.find((profile) => profile.id === selector)
  if (exactId) {
    return { profile: exactId, matchedBy: 'id' }
  }

  const normalizedSelector = selector.toLowerCase()
  const exactName = profiles.find(
    (profile) => profile.name.toLowerCase() === normalizedSelector,
  )
  if (exactName) {
    return { profile: exactName, matchedBy: 'name' }
  }

  const prefixMatches = profiles.filter(
    (profile) =>
      profile.id.startsWith(selector) ||
      profile.name.toLowerCase().startsWith(normalizedSelector),
  )

  if (prefixMatches.length === 1) {
    return { profile: prefixMatches[0], matchedBy: 'prefix' }
  }

  if (prefixMatches.length > 1) {
    throw new Error(
      `Profile selector "${selector}" is ambiguous: ` +
        prefixMatches
          .map((profile) => `${profile.name} (${profile.id})`)
          .join(', '),
    )
  }

  throw new Error(`Profile not found: ${selector}`)
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

async function probeProfileMcp(
  profile: BrowserProfileConfig,
  timeoutMs: number,
): Promise<{ ready: boolean; port: number }> {
  const port = getProfileMcpPort(profile.id)
  const ready = await waitForMcpServer(port, getProfileHost(profile), timeoutMs)
  return { ready, port }
}

async function waitForProfileMcp(
  profileId: string,
  timeoutMs: number,
): Promise<{ profile: BrowserProfileConfig; port: number }> {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    const profile = getProfile(profileId)
    if (!profile) {
      throw new Error(`Profile not found: ${profileId}`)
    }

    const remaining = Math.max(250, deadline - Date.now())
    const { ready, port } = await probeProfileMcp(
      profile,
      Math.min(PROBE_TIMEOUT_MS, remaining),
    )

    if (ready) {
      return { profile, port }
    }

    await sleep(RETRY_DELAY_MS)
  }

  throw new Error(`Timed out waiting for MCP server for profile ${profileId}`)
}

export class ProfileRuntimeManager {
  private clients = new Map<string, CraftMcpClient>()

  async inspectProfile(
    profileOrSelector: BrowserProfileConfig | string,
  ): Promise<{
    profile: BrowserProfileConfig
    pidAlive: boolean
    mcpReady: boolean
    port: number
    host: string
    baseUrl: string
    mcpUrl: string
  }> {
    const profile =
      typeof profileOrSelector === 'string'
        ? resolveProfileSelection(profileOrSelector).profile
        : profileOrSelector

    const { ready, port } = await probeProfileMcp(profile, PROBE_TIMEOUT_MS)

    return {
      profile,
      pidAlive: isProcessAlive(profile.pid),
      mcpReady: ready,
      port,
      host: getProfileHost(profile),
      baseUrl: buildProfileBaseUrl(profile, port),
      mcpUrl: buildProfileMcpUrl(profile, port),
    }
  }

  async ensureProfile(
    profileOrSelector: BrowserProfileConfig | string,
    options: EnsureProfileOptions = {},
  ): Promise<ProfileSession> {
    const timeoutMs = options.timeoutMs ?? DEFAULT_MCP_WAIT_MS
    const selection =
      typeof profileOrSelector === 'string'
        ? resolveProfileSelection(profileOrSelector)
        : { profile: profileOrSelector, matchedBy: 'id' as const }

    const initial = await this.inspectProfile(selection.profile)

    if (initial.mcpReady) {
      return {
        profile: initial.profile,
        host: initial.host,
        port: initial.port,
        baseUrl: initial.baseUrl,
        mcpUrl: initial.mcpUrl,
        pid: initial.profile.pid,
        pidAlive: initial.pidAlive,
        mcpReady: true,
        launched: false,
      }
    }

    if (initial.profile.status === 'running' && !initial.pidAlive) {
      updateProfileStatus(initial.profile.id, 'idle')
    }

    if (initial.pidAlive) {
      const waited = await waitForProfileMcp(initial.profile.id, timeoutMs)
      return {
        profile: waited.profile,
        host: getProfileHost(waited.profile),
        port: waited.port,
        baseUrl: buildProfileBaseUrl(waited.profile, waited.port),
        mcpUrl: buildProfileMcpUrl(waited.profile, waited.port),
        pid: waited.profile.pid,
        pidAlive: true,
        mcpReady: true,
        launched: false,
      }
    }

    const launchResult = await launchBrowser(initial.profile)
    if (!launchResult.success) {
      throw new Error(launchResult.error || 'Failed to launch browser profile')
    }

    const waited = await waitForProfileMcp(initial.profile.id, timeoutMs)
    return {
      profile: waited.profile,
      host: getProfileHost(waited.profile),
      port: waited.port,
      baseUrl: buildProfileBaseUrl(waited.profile, waited.port),
      mcpUrl: buildProfileMcpUrl(waited.profile, waited.port),
      pid: launchResult.pid ?? waited.profile.pid,
      pidAlive: true,
      mcpReady: true,
      launched: true,
    }
  }

  private async connectClient(
    session: ProfileSession,
  ): Promise<CraftMcpClient> {
    const existing = this.clients.get(session.profile.id)
    if (existing) {
      return existing
    }

    const client = new CraftMcpClient({
      transport: 'http',
      url: session.mcpUrl,
    })
    await client.connect()
    this.clients.set(session.profile.id, client)
    return client
  }

  async getClient(
    profileOrSelector: BrowserProfileConfig | string,
    options?: EnsureProfileOptions,
  ): Promise<{ client: CraftMcpClient; session: ProfileSession }> {
    const session = await this.ensureProfile(profileOrSelector, options)
    const client = await this.connectClient(session)
    return { client, session }
  }

  async callTool<T = unknown>(
    profileOrSelector: BrowserProfileConfig | string,
    toolName: string,
    args: Record<string, unknown> = {},
    options?: EnsureProfileOptions,
  ): Promise<{ result: T; session: ProfileSession }> {
    const selection =
      typeof profileOrSelector === 'string'
        ? resolveProfileSelection(profileOrSelector)
        : { profile: profileOrSelector, matchedBy: 'id' as const }

    const { client, session } = await this.getClient(selection.profile, options)

    try {
      const result = await client.callTool(toolName, args)
      return { result: result as T, session }
    } catch {
      await client.close().catch(() => {})
      this.clients.delete(selection.profile.id)

      const retry = await this.getClient(selection.profile, options)
      const result = await retry.client.callTool(toolName, args)
      return { result: result as T, session: retry.session }
    }
  }

  async listTools(
    profileOrSelector: BrowserProfileConfig | string,
    options?: EnsureProfileOptions,
  ): Promise<{ tools: Tool[]; session: ProfileSession }> {
    const { client, session } = await this.getClient(profileOrSelector, options)
    return {
      tools: await client.listTools(),
      session,
    }
  }

  async getActiveTab(
    profileOrSelector: BrowserProfileConfig | string,
  ): Promise<{
    tabId: number
    windowId?: number
    url?: string
    title?: string
  }> {
    const { result } = await this.callTool<
      BrowserToolResult<{
        tabId: number
        windowId?: number
        url?: string
        title?: string
      }>
    >(profileOrSelector, 'browser_get_active_tab')

    const tab = getStructuredContentFromToolResult<{
      tabId: number
      windowId?: number
      url?: string
      title?: string
    }>(result)

    if (!tab?.tabId) {
      throw new Error('Failed to resolve active tab')
    }

    return tab
  }

  async waitForLoad(
    profileOrSelector: BrowserProfileConfig | string,
    tabId: number,
    timeoutMs = DEFAULT_MCP_WAIT_MS,
  ): Promise<
    BrowserToolResult<{
      tabId: number
      isResourcesLoading: boolean
      isDOMContentLoaded: boolean
      isPageComplete: boolean
    }>
  > {
    const deadline = Date.now() + timeoutMs

    while (Date.now() < deadline) {
      const { result } = await this.callTool<
        BrowserToolResult<{
          tabId: number
          isResourcesLoading: boolean
          isDOMContentLoaded: boolean
          isPageComplete: boolean
        }>
      >(profileOrSelector, 'browser_get_load_status', { tabId })

      const status = getStructuredContentFromToolResult<{
        tabId: number
        isResourcesLoading: boolean
        isDOMContentLoaded: boolean
        isPageComplete: boolean
      }>(result)

      if (status?.isPageComplete && status?.isDOMContentLoaded) {
        return result
      }

      await sleep(RETRY_DELAY_MS)
    }

    throw new Error(`Timed out waiting for tab ${tabId} to finish loading`)
  }

  async close(): Promise<void> {
    const clients = Array.from(this.clients.values())
    this.clients.clear()
    await Promise.all(clients.map((client) => client.close().catch(() => {})))
  }

  async stopProfile(profileOrSelector: BrowserProfileConfig | string): Promise<{
    profile: BrowserProfileConfig
    stopped: boolean
  }> {
    const selection =
      typeof profileOrSelector === 'string'
        ? resolveProfileSelection(profileOrSelector)
        : { profile: profileOrSelector, matchedBy: 'id' as const }

    const client = this.clients.get(selection.profile.id)
    if (client) {
      await client.close().catch(() => {})
      this.clients.delete(selection.profile.id)
    }

    const stopped = stopBrowser(selection.profile.id)
    return { profile: selection.profile, stopped }
  }
}
