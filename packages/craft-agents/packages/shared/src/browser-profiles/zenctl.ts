import { existsSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import { loadStoredConfig } from '../config/storage.ts'
import { createSource, loadWorkspaceSources } from '../sources/index.ts'
import { loadWorkspace } from '../workspaces/index.ts'
import { getProfileMcpPort } from './launcher.ts'
import {
  type BrowserToolResult,
  getStructuredContentFromToolResult,
  getTextFromToolResult,
  isBrowserToolResult,
  isProcessAlive,
  ProfileRuntimeManager,
  type ProfileSession,
  resolveProfileSelection,
} from './runtime.ts'
import { listProfiles } from './storage.ts'
import type { BrowserProfileConfig } from './types.ts'

function resolveZenctlScriptPath(): string {
  // ESM context (Bun / unbundled)
  try {
    if (import.meta.url) {
      return fileURLToPath(
        new URL('../../../../scripts/zenctl.ts', import.meta.url),
      )
    }
  } catch {
    // fall through to CJS fallback
  }

  // CJS bundle fallback: esbuild outputs to apps/electron/dist/main.cjs
  // __dirname = <craft-agents>/apps/electron/dist
  const candidate = join(__dirname, '..', '..', '..', 'scripts', 'zenctl.ts')
  if (existsSync(candidate)) {
    return candidate
  }

  // Last resort: resolve from cwd (electron-dev sets cwd to craft-agents root)
  return join(process.cwd(), 'scripts', 'zenctl.ts')
}

let _zenctlScriptPath: string | undefined
function getZenctlScriptPath(): string {
  if (!_zenctlScriptPath) {
    _zenctlScriptPath = resolveZenctlScriptPath()
  }
  return _zenctlScriptPath
}

interface ParsedArgs {
  options: Map<string, string | boolean>
  positionals: string[]
}

function parseArgs(argv: string[]): ParsedArgs {
  const options = new Map<string, string | boolean>()
  const positionals: string[] = []

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]

    if (!token.startsWith('-')) {
      positionals.push(token)
      continue
    }

    if (token === '--') {
      positionals.push(...argv.slice(i + 1))
      break
    }

    const [rawKey, inlineValue] = token.split('=', 2)
    const key = rawKey.replace(/^-+/, '')

    if (inlineValue !== undefined) {
      options.set(key, inlineValue)
      continue
    }

    const next = argv[i + 1]
    if (next && !next.startsWith('-')) {
      options.set(key, next)
      i += 1
      continue
    }

    options.set(key, true)
  }

  return { options, positionals }
}

function getStringOption(
  args: ParsedArgs,
  ...keys: string[]
): string | undefined {
  for (const key of keys) {
    const value = args.options.get(key)
    if (typeof value === 'string') {
      return value
    }
  }

  return undefined
}

function hasFlag(args: ParsedArgs, ...keys: string[]): boolean {
  return keys.some((key) => args.options.get(key) === true)
}

function parseJsonArgs(raw: string | undefined): Record<string, unknown> {
  if (!raw) {
    return {}
  }

  const parsed = JSON.parse(raw) as unknown
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Tool args JSON must be an object')
  }

  return parsed as Record<string, unknown>
}

function asJson(value: unknown): string {
  return JSON.stringify(value, null, 2)
}

function printValue(value: unknown, json: boolean): void {
  if (json) {
    console.log(asJson(value))
    return
  }

  if (isBrowserToolResult(value)) {
    const text = getTextFromToolResult(value)
    if (text) {
      console.log(text)
      return
    }
  }

  if (typeof value === 'string') {
    console.log(value)
    return
  }

  console.log(asJson(value))
}

function parseTabSpecifier(value: string | undefined): number | undefined {
  if (!value || value === 'active') {
    return undefined
  }

  const parsed = Number.parseInt(value, 10)
  if (Number.isNaN(parsed) || parsed <= 0) {
    throw new Error(`Invalid tab id: ${value}`)
  }

  return parsed
}

async function resolveTabId(
  manager: ProfileRuntimeManager,
  profileId: string,
  rawTabId: string | undefined,
): Promise<number> {
  const explicitTabId = parseTabSpecifier(rawTabId)
  if (explicitTabId) {
    return explicitTabId
  }

  const activeTab = await manager.getActiveTab(profileId)
  return activeTab.tabId
}

function serializeSession(session: ProfileSession): Record<string, unknown> {
  return {
    profileId: session.profile.id,
    profileName: session.profile.name,
    pid: session.pid,
    launched: session.launched,
    pidAlive: session.pidAlive,
    mcpReady: session.mcpReady,
    host: session.host,
    port: session.port,
    baseUrl: session.baseUrl,
    mcpUrl: session.mcpUrl,
  }
}

async function listProfilesWithState(): Promise<Record<string, unknown>[]> {
  const manager = new ProfileRuntimeManager()
  try {
    const profiles = listProfiles()

    return await Promise.all(
      profiles.map(async (profile) => {
        const inspection = await manager.inspectProfile(profile)
        return {
          id: profile.id,
          name: profile.name,
          browserEngine: profile.browserEngine,
          status: profile.status,
          pid: profile.pid,
          pidAlive: inspection.pidAlive,
          mcpPort: inspection.port,
          mcpUrl: inspection.mcpUrl,
          mcpReady: inspection.mcpReady,
          startupUrl: profile.startupUrl,
          lastLaunchedAt: profile.lastLaunchedAt,
          lastError: profile.lastError,
        }
      }),
    )
  } finally {
    await manager.close()
  }
}

function formatProfilesTable(items: Record<string, unknown>[]): string {
  if (items.length === 0) {
    return 'No browser profiles found.'
  }

  return items
    .map((item) => {
      const status = item.status || 'unknown'
      const ready = item.mcpReady ? 'ready' : 'offline'
      return `${item.name} (${item.id})\n  status: ${status} | mcp: ${ready} | port: ${item.mcpPort}`
    })
    .join('\n')
}

function helpText(): string {
  return [
    'zenctl',
    '',
    'Commands:',
    '  profiles list [--json]',
    '  ensure --profile <profileId> [--json]',
    '  stop --profile <profileId> [--json]',
    '  nav --profile <profileId> <url> [--tab active|<id>] [--no-wait] [--json]',
    '  tabs --profile <profileId> [--json]',
    '  read --profile <profileId> [--tab active|<id>] [--links] [--page <n|all>] [--json]',
    '  elements --profile <profileId> [--tab active|<id>] [--simplified] [--json]',
    '  click --profile <profileId> --node <nodeId> [--tab active|<id>] [--no-wait] [--json]',
    '  type --profile <profileId> --node <nodeId> --text <value> [--tab active|<id>] [--json]',
    '  screenshot --profile <profileId> [--tab active|<id>] [--output <path>] [--json]',
    '  tool call --profile <profileId> <toolName> [argsJson] [--json]',
    '  context --profile <profileId> [--tab active|<id>] [--links] [--simplified] [--json]',
    '  mcp serve [--profile <profileId>]',
    '  mcp source-config [--profile <profileId>] [--json]',
    '  mcp install [--profile <profileId>] [--workspace <rootPath>] [--name <sourceName>] [--json]',
    '',
    'Examples:',
    '  bun run zenctl -- profiles list',
    '  bun run zenctl -- ensure --profile zen03',
    '  bun run zenctl -- nav --profile zen03 https://example.com',
    '  bun run zenctl -- tool call --profile zen03 browser_list_tabs "{}"',
    '  bun run zenctl -- context --profile zen03',
    '  bun run zenctl -- mcp source-config --profile zen03',
    '  bun run zenctl -- mcp install --profile zen03 --workspace /path/to/workspace',
    '  bun run zenctl -- mcp serve --profile zen03',
  ].join('\n')
}

function requireProfileOption(args: ParsedArgs): string {
  const profileId = getStringOption(args, 'profile', 'p')
  if (!profileId) {
    throw new Error('Missing required option: --profile <profileId>')
  }

  return profileId
}

function toTextResult(
  text: string,
  structuredContent?: Record<string, unknown>,
): CallToolResult {
  return {
    content: [{ type: 'text', text }],
    ...(structuredContent ? { structuredContent } : {}),
  }
}

function toErrorResult(message: string): CallToolResult {
  return {
    content: [{ type: 'text', text: message }],
    isError: true,
  }
}

function relayToolResult(result: unknown): CallToolResult {
  if (isBrowserToolResult(result)) {
    const structuredContent =
      result.structuredContent &&
      typeof result.structuredContent === 'object' &&
      !Array.isArray(result.structuredContent)
        ? (result.structuredContent as Record<string, unknown>)
        : undefined

    return {
      content: result.content ?? [{ type: 'text', text: '' }],
      ...(structuredContent ? { structuredContent } : {}),
      ...(result.isError ? { isError: true } : {}),
    }
  }

  if (result && typeof result === 'object' && !Array.isArray(result)) {
    return toTextResult(asJson(result), result as Record<string, unknown>)
  }

  return toTextResult(String(result))
}

function buildProfileSummary(profile: BrowserProfileConfig): string {
  const port = getProfileMcpPort(profile.id)
  const pidState =
    profile.pid && isProcessAlive(profile.pid) ? 'alive' : 'stopped'
  return `${profile.name} (${profile.id}) | pid: ${profile.pid ?? 'n/a'} (${pidState}) | mcp: http://127.0.0.1:${port}/mcp`
}

function buildSourceConfig(
  profileId?: string,
  sourceName?: string,
): {
  name: string
  provider: string
  type: 'mcp'
  icon: string
  mcp: {
    transport: 'stdio'
    command: string
    args: string[]
  }
} {
  const profile = profileId
    ? resolveProfileSelection(profileId).profile
    : undefined
  const resolvedName =
    sourceName ||
    (profile ? `Zen Browser ${profile.name}` : 'Zen Browser Controller')

  return {
    name: resolvedName,
    provider: 'zenctl',
    type: 'mcp',
    icon: '🌐',
    mcp: {
      transport: 'stdio',
      command: process.execPath,
      args: [
        getZenctlScriptPath(),
        'mcp',
        'serve',
        ...(profile ? ['--profile', profile.id] : []),
      ],
    },
  }
}

function getDefaultWorkspaceRoot(): string | undefined {
  const config = loadStoredConfig()
  if (!config) {
    return undefined
  }

  const activeWorkspace =
    config.workspaces.find(
      (workspace) => workspace.id === config.activeWorkspaceId,
    ) || config.workspaces[0]

  return activeWorkspace?.rootPath
}

async function installSource(
  workspaceRootPath: string,
  profileId?: string,
  sourceName?: string,
): Promise<Record<string, unknown>> {
  const workspace = loadWorkspace(workspaceRootPath)
  if (!workspace) {
    throw new Error(`Workspace not found or invalid: ${workspaceRootPath}`)
  }

  const sourceConfig = buildSourceConfig(profileId, sourceName)
  const existing = loadWorkspaceSources(workspaceRootPath).find((source) => {
    const mcp = source.config.mcp
    if (source.config.type !== 'mcp' || mcp?.transport !== 'stdio') {
      return false
    }

    if (mcp.command !== sourceConfig.mcp.command) {
      return false
    }

    if (
      JSON.stringify(mcp.args || []) !== JSON.stringify(sourceConfig.mcp.args)
    ) {
      return false
    }

    return true
  })

  if (existing) {
    return {
      installed: false,
      workspaceRootPath,
      workspaceName: workspace.config.name,
      sourceSlug: existing.config.slug,
      sourceId: existing.config.id,
      sourceName: existing.config.name,
      reason: 'already_installed',
      sourceConfig,
    }
  }

  const created = await createSource(workspaceRootPath, sourceConfig)
  return {
    installed: true,
    workspaceRootPath,
    workspaceName: workspace.config.name,
    sourceSlug: created.slug,
    sourceId: created.id,
    sourceName: created.name,
    sourceConfig,
  }
}

async function getPageContext(
  manager: ProfileRuntimeManager,
  profileId: string | undefined,
  options?: {
    tabId?: number
    includeLinks?: boolean
    simplified?: boolean
  },
): Promise<{
  tab: Record<string, unknown>
  pageText: string
  elementsText: string
}> {
  const targetProfile = profileId
  const activeTab = await manager.getActiveTab(targetProfile)
  const tabId = options?.tabId ?? activeTab.tabId

  let tab: Record<string, unknown> = activeTab
  if (tabId !== activeTab.tabId) {
    const tabsResult = await manager.callTool<
      BrowserToolResult<{
        tabs?: Array<Record<string, unknown>>
      }>
    >(targetProfile, 'browser_list_tabs')

    const tabs = getStructuredContentFromToolResult<{
      tabs?: Array<Record<string, unknown>>
    }>(tabsResult.result)?.tabs

    const matchedTab = tabs?.find((item) => item.id === tabId)
    if (matchedTab) {
      tab = {
        tabId: matchedTab.id,
        windowId: matchedTab.windowId,
        url: matchedTab.url,
        title: matchedTab.title,
      }
    }
  }

  const [pageResult, elementsResult] = await Promise.all([
    manager.callTool(targetProfile, 'browser_get_page_content', {
      tabId,
      type: options?.includeLinks ? 'text-with-links' : 'text',
    }),
    manager.callTool(targetProfile, 'browser_get_interactive_elements', {
      tabId,
      ...(options?.simplified ? { simplified: true } : {}),
    }),
  ])

  return {
    tab,
    pageText: getTextFromToolResult(pageResult.result),
    elementsText: getTextFromToolResult(elementsResult.result),
  }
}

async function createMcpServer(
  manager: ProfileRuntimeManager,
  defaultProfileId?: string,
): Promise<McpServer> {
  const server = new McpServer(
    {
      name: 'zenctl',
      title: 'Zen Profile Browser Controller',
      version: '0.1.0',
    },
    { capabilities: { logging: {} } },
  )

  const resolveTarget = (profileId?: string): string | undefined =>
    profileId || defaultProfileId

  server.registerTool(
    'profile_list',
    {
      description:
        'List available fingerprint browser profiles and their MCP readiness.',
    },
    async () => {
      const profiles = await listProfilesWithState()
      return toTextResult(formatProfilesTable(profiles), { profiles })
    },
  )

  server.registerTool(
    'profile_ensure_started',
    {
      description:
        'Ensure a profile browser is running and its MCP endpoint is ready.',
      inputSchema: {
        profileId: z
          .string()
          .optional()
          .describe(
            'Profile id or unique profile name. Optional when --profile is fixed.',
          ),
      },
    },
    async ({ profileId }) => {
      try {
        const session = await manager.ensureProfile(resolveTarget(profileId))
        return toTextResult(
          `Profile ready: ${session.profile.name} (${session.profile.id})`,
          serializeSession(session),
        )
      } catch (error) {
        return toErrorResult(
          error instanceof Error ? error.message : String(error),
        )
      }
    },
  )

  server.registerTool(
    'profile_get_active_tab',
    {
      description:
        'Get the current active tab for a profile. Use this before reading, clicking, or typing.',
      inputSchema: {
        profileId: z.string().optional(),
      },
    },
    async ({ profileId }) => {
      try {
        const tab = await manager.getActiveTab(resolveTarget(profileId))
        return toTextResult(
          `Active tab: ${tab.title || '(untitled)'}\nURL: ${tab.url || ''}\nTab ID: ${tab.tabId}`,
          { ...tab },
        )
      } catch (error) {
        return toErrorResult(
          error instanceof Error ? error.message : String(error),
        )
      }
    },
  )

  server.registerTool(
    'profile_list_tabs',
    {
      description: 'List all open tabs for a profile.',
      inputSchema: {
        profileId: z.string().optional(),
      },
    },
    async ({ profileId }) => {
      try {
        const { result } = await manager.callTool(
          resolveTarget(profileId),
          'browser_list_tabs',
        )
        return relayToolResult(result)
      } catch (error) {
        return toErrorResult(
          error instanceof Error ? error.message : String(error),
        )
      }
    },
  )

  server.registerTool(
    'profile_open_url',
    {
      description:
        'Navigate the current tab or a specified tab to a URL, then wait for load by default.',
      inputSchema: {
        profileId: z.string().optional(),
        url: z.string().describe('URL to open, including protocol.'),
        tabId: z.number().optional(),
        waitForLoad: z.boolean().optional(),
      },
    },
    async ({ profileId, url, tabId, waitForLoad }) => {
      try {
        const { result } = await manager.callTool<
          BrowserToolResult<{ tabId: number; windowId?: number; url?: string }>
        >(resolveTarget(profileId), 'browser_navigate', {
          url,
          ...(tabId ? { tabId } : {}),
        })

        const structured = getStructuredContentFromToolResult<{
          tabId: number
          windowId?: number
          url?: string
        }>(result)

        if (structured?.tabId && waitForLoad !== false) {
          await manager.waitForLoad(resolveTarget(profileId), structured.tabId)
        }

        return relayToolResult(result)
      } catch (error) {
        return toErrorResult(
          error instanceof Error ? error.message : String(error),
        )
      }
    },
  )

  server.registerTool(
    'profile_read_page',
    {
      description:
        'Read text from the current page. This is the main tool for human-like page understanding.',
      inputSchema: {
        profileId: z.string().optional(),
        tabId: z.number().optional(),
        mode: z.enum(['text', 'text-with-links']).optional(),
        page: z.string().optional(),
        contextWindow: z.string().optional(),
      },
    },
    async ({ profileId, tabId, mode, page, contextWindow }) => {
      try {
        const targetProfile = resolveTarget(profileId)
        const resolvedTabId =
          tabId ?? (await manager.getActiveTab(targetProfile)).tabId

        const { result } = await manager.callTool(
          targetProfile,
          'browser_get_page_content',
          {
            tabId: resolvedTabId,
            type: mode || 'text',
            ...(page ? { page } : {}),
            ...(contextWindow ? { contextWindow } : {}),
          },
        )

        return relayToolResult(result)
      } catch (error) {
        return toErrorResult(
          error instanceof Error ? error.message : String(error),
        )
      }
    },
  )

  server.registerTool(
    'profile_get_page_context',
    {
      description:
        'Return a human-browsing bundle for a profile: active tab metadata, readable page text, and interactive elements.',
      inputSchema: {
        profileId: z.string().optional(),
        tabId: z.number().optional(),
        includeLinks: z.boolean().optional(),
        simplified: z.boolean().optional(),
      },
    },
    async ({ profileId, tabId, includeLinks, simplified }) => {
      try {
        const context = await getPageContext(
          manager,
          resolveTarget(profileId),
          {
            tabId,
            includeLinks,
            simplified,
          },
        )

        const text = [
          `Active Tab: ${String(context.tab.title || '(untitled)')}`,
          `URL: ${String(context.tab.url || '')}`,
          `Tab ID: ${String(context.tab.tabId || '')}`,
          '',
          'PAGE CONTENT',
          context.pageText,
          '',
          'INTERACTIVE ELEMENTS',
          context.elementsText,
        ].join('\n')

        return toTextResult(text, {
          tab: context.tab,
          pageText: context.pageText,
          elementsText: context.elementsText,
        })
      } catch (error) {
        return toErrorResult(
          error instanceof Error ? error.message : String(error),
        )
      }
    },
  )

  server.registerTool(
    'profile_list_interactive_elements',
    {
      description:
        'List clickable and typeable elements from the page so the agent can act like a person.',
      inputSchema: {
        profileId: z.string().optional(),
        tabId: z.number().optional(),
        simplified: z.boolean().optional(),
      },
    },
    async ({ profileId, tabId, simplified }) => {
      try {
        const targetProfile = resolveTarget(profileId)
        const resolvedTabId =
          tabId ?? (await manager.getActiveTab(targetProfile)).tabId

        const { result } = await manager.callTool(
          targetProfile,
          'browser_get_interactive_elements',
          {
            tabId: resolvedTabId,
            ...(simplified ? { simplified } : {}),
          },
        )

        return relayToolResult(result)
      } catch (error) {
        return toErrorResult(
          error instanceof Error ? error.message : String(error),
        )
      }
    },
  )

  server.registerTool(
    'profile_click_element',
    {
      description:
        'Click an element by nodeId in a profile tab. Use with profile_list_interactive_elements.',
      inputSchema: {
        profileId: z.string().optional(),
        tabId: z.number().optional(),
        nodeId: z.number(),
        waitForLoad: z.boolean().optional(),
      },
    },
    async ({ profileId, tabId, nodeId, waitForLoad }) => {
      try {
        const targetProfile = resolveTarget(profileId)
        const resolvedTabId =
          tabId ?? (await manager.getActiveTab(targetProfile)).tabId

        const { result } = await manager.callTool(
          targetProfile,
          'browser_click_element',
          {
            tabId: resolvedTabId,
            nodeId,
          },
        )

        if (waitForLoad !== false) {
          await manager
            .waitForLoad(targetProfile, resolvedTabId)
            .catch(() => {})
        }

        return relayToolResult(result)
      } catch (error) {
        return toErrorResult(
          error instanceof Error ? error.message : String(error),
        )
      }
    },
  )

  server.registerTool(
    'profile_type_text',
    {
      description:
        'Type text into an input element by nodeId in a profile tab.',
      inputSchema: {
        profileId: z.string().optional(),
        tabId: z.number().optional(),
        nodeId: z.number(),
        text: z.string(),
        waitForLoad: z.boolean().optional(),
      },
    },
    async ({ profileId, tabId, nodeId, text, waitForLoad }) => {
      try {
        const targetProfile = resolveTarget(profileId)
        const resolvedTabId =
          tabId ?? (await manager.getActiveTab(targetProfile)).tabId

        const { result } = await manager.callTool(
          targetProfile,
          'browser_type_text',
          {
            tabId: resolvedTabId,
            nodeId,
            text,
          },
        )

        if (waitForLoad === true) {
          await manager
            .waitForLoad(targetProfile, resolvedTabId)
            .catch(() => {})
        }

        return relayToolResult(result)
      } catch (error) {
        return toErrorResult(
          error instanceof Error ? error.message : String(error),
        )
      }
    },
  )

  server.registerTool(
    'profile_wait_for_load',
    {
      description: 'Wait until a tab is fully loaded.',
      inputSchema: {
        profileId: z.string().optional(),
        tabId: z.number().optional(),
        timeoutMs: z.number().optional(),
      },
    },
    async ({ profileId, tabId, timeoutMs }) => {
      try {
        const targetProfile = resolveTarget(profileId)
        const resolvedTabId =
          tabId ?? (await manager.getActiveTab(targetProfile)).tabId

        const result = await manager.waitForLoad(
          targetProfile,
          resolvedTabId,
          timeoutMs,
        )
        return relayToolResult(result)
      } catch (error) {
        return toErrorResult(
          error instanceof Error ? error.message : String(error),
        )
      }
    },
  )

  server.registerTool(
    'profile_get_screenshot',
    {
      description:
        'Capture a screenshot from a profile tab. Useful for visual verification.',
      inputSchema: {
        profileId: z.string().optional(),
        tabId: z.number().optional(),
      },
    },
    async ({ profileId, tabId }) => {
      try {
        const targetProfile = resolveTarget(profileId)
        const resolvedTabId =
          tabId ?? (await manager.getActiveTab(targetProfile)).tabId

        const { result } = await manager.callTool(
          targetProfile,
          'browser_get_screenshot',
          {
            tabId: resolvedTabId,
            size: 'medium',
          },
        )

        return relayToolResult(result)
      } catch (error) {
        return toErrorResult(
          error instanceof Error ? error.message : String(error),
        )
      }
    },
  )

  server.registerTool(
    'profile_call_browser_tool',
    {
      description:
        'Call any raw browser MCP tool against a profile. Use this for advanced cases not covered by the higher-level tools.',
      inputSchema: {
        profileId: z.string().optional(),
        toolName: z.string(),
        args: z.record(z.string(), z.unknown()).optional(),
      },
    },
    async ({ profileId, toolName, args }) => {
      try {
        const { result } = await manager.callTool(
          resolveTarget(profileId),
          toolName,
          args || {},
        )
        return relayToolResult(result)
      } catch (error) {
        return toErrorResult(
          error instanceof Error ? error.message : String(error),
        )
      }
    },
  )

  server.registerTool(
    'profile_stop',
    {
      description: 'Stop a running browser profile process.',
      inputSchema: {
        profileId: z.string().optional(),
      },
    },
    async ({ profileId }) => {
      try {
        const { profile, stopped } = await manager.stopProfile(
          resolveTarget(profileId),
        )
        return toTextResult(
          stopped
            ? `Stopped profile ${profile.name} (${profile.id})`
            : `Profile ${profile.name} (${profile.id}) was not running in this process. The MCP sidecar may still be external.`,
          { profileId: profile.id, stopped },
        )
      } catch (error) {
        return toErrorResult(
          error instanceof Error ? error.message : String(error),
        )
      }
    },
  )

  return server
}

async function saveScreenshot(
  result: unknown,
  outputPath: string,
): Promise<Record<string, unknown>> {
  const toolResult = result as BrowserToolResult
  const imageItem = toolResult.content?.find(
    (item) => item.type === 'image' && item.data,
  )

  if (!imageItem?.data) {
    throw new Error('Screenshot result did not include image data')
  }

  const data = imageItem.data.includes(',')
    ? imageItem.data.split(',', 2)[1]
    : imageItem.data
  const buffer = Buffer.from(data, 'base64')
  await writeFile(outputPath, buffer)

  return {
    outputPath,
    mimeType: imageItem.mimeType || 'image/png',
    byteLength: buffer.byteLength,
  }
}

async function runCliCommand(argv: string[]): Promise<number> {
  const [command, maybeSubcommand, ...rest] = argv

  if (
    !command ||
    command === 'help' ||
    command === '--help' ||
    command === '-h'
  ) {
    console.log(helpText())
    return 0
  }

  if (command === 'profiles' && maybeSubcommand === 'list') {
    const parsed = parseArgs(rest)
    const items = await listProfilesWithState()
    if (hasFlag(parsed, 'json', 'j')) {
      console.log(asJson({ profiles: items }))
    } else {
      console.log(formatProfilesTable(items))
    }
    return 0
  }

  const manager = new ProfileRuntimeManager()

  try {
    switch (command) {
      case 'ensure': {
        const parsed = parseArgs(
          [maybeSubcommand, ...rest].filter(Boolean) as string[],
        )
        const profileId = requireProfileOption(parsed)
        const session = await manager.ensureProfile(profileId)
        printValue(serializeSession(session), hasFlag(parsed, 'json', 'j'))
        return 0
      }

      case 'stop': {
        const parsed = parseArgs(
          [maybeSubcommand, ...rest].filter(Boolean) as string[],
        )
        const profileId = requireProfileOption(parsed)
        const result = await manager.stopProfile(profileId)
        printValue(
          {
            profileId: result.profile.id,
            profileName: result.profile.name,
            stopped: result.stopped,
          },
          hasFlag(parsed, 'json', 'j'),
        )
        return 0
      }

      case 'nav': {
        const parsed = parseArgs(
          [maybeSubcommand, ...rest].filter(Boolean) as string[],
        )
        const profileId = requireProfileOption(parsed)
        const url = parsed.positionals[0] || getStringOption(parsed, 'url')
        if (!url) {
          throw new Error('Missing URL. Usage: nav --profile <profileId> <url>')
        }

        const tabId = parseTabSpecifier(getStringOption(parsed, 'tab'))
        const { result } = await manager.callTool(
          profileId,
          'browser_navigate',
          {
            url,
            ...(tabId ? { tabId } : {}),
          },
        )

        const structured = getStructuredContentFromToolResult<{
          tabId: number
        }>(result)
        if (structured?.tabId && !hasFlag(parsed, 'no-wait')) {
          await manager.waitForLoad(profileId, structured.tabId)
        }

        printValue(result, hasFlag(parsed, 'json', 'j'))
        return 0
      }

      case 'tabs': {
        const parsed = parseArgs(
          [maybeSubcommand, ...rest].filter(Boolean) as string[],
        )
        const profileId = requireProfileOption(parsed)
        const { result } = await manager.callTool(
          profileId,
          'browser_list_tabs',
        )
        printValue(result, hasFlag(parsed, 'json', 'j'))
        return 0
      }

      case 'read': {
        const parsed = parseArgs(
          [maybeSubcommand, ...rest].filter(Boolean) as string[],
        )
        const profileId = requireProfileOption(parsed)
        const tabId = await resolveTabId(
          manager,
          profileId,
          getStringOption(parsed, 'tab'),
        )
        const { result } = await manager.callTool(
          profileId,
          'browser_get_page_content',
          {
            tabId,
            type: hasFlag(parsed, 'links') ? 'text-with-links' : 'text',
            ...(getStringOption(parsed, 'page')
              ? { page: getStringOption(parsed, 'page') }
              : {}),
            ...(getStringOption(parsed, 'context-window')
              ? { contextWindow: getStringOption(parsed, 'context-window') }
              : {}),
          },
        )
        printValue(result, hasFlag(parsed, 'json', 'j'))
        return 0
      }

      case 'elements': {
        const parsed = parseArgs(
          [maybeSubcommand, ...rest].filter(Boolean) as string[],
        )
        const profileId = requireProfileOption(parsed)
        const tabId = await resolveTabId(
          manager,
          profileId,
          getStringOption(parsed, 'tab'),
        )
        const { result } = await manager.callTool(
          profileId,
          'browser_get_interactive_elements',
          {
            tabId,
            ...(hasFlag(parsed, 'simplified') ? { simplified: true } : {}),
          },
        )
        printValue(result, hasFlag(parsed, 'json', 'j'))
        return 0
      }

      case 'click': {
        const parsed = parseArgs(
          [maybeSubcommand, ...rest].filter(Boolean) as string[],
        )
        const profileId = requireProfileOption(parsed)
        const rawNodeId =
          getStringOption(parsed, 'node') || parsed.positionals[0]
        if (!rawNodeId) {
          throw new Error('Missing node id. Pass --node <nodeId>')
        }
        const nodeId = Number.parseInt(rawNodeId, 10)
        if (Number.isNaN(nodeId)) {
          throw new Error(`Invalid node id: ${rawNodeId}`)
        }

        const tabId = await resolveTabId(
          manager,
          profileId,
          getStringOption(parsed, 'tab'),
        )

        const { result } = await manager.callTool(
          profileId,
          'browser_click_element',
          { tabId, nodeId },
        )

        if (!hasFlag(parsed, 'no-wait')) {
          await manager.waitForLoad(profileId, tabId).catch(() => {})
        }

        printValue(result, hasFlag(parsed, 'json', 'j'))
        return 0
      }

      case 'type': {
        const parsed = parseArgs(
          [maybeSubcommand, ...rest].filter(Boolean) as string[],
        )
        const profileId = requireProfileOption(parsed)
        const rawNodeId =
          getStringOption(parsed, 'node') || parsed.positionals[0]
        const text = getStringOption(parsed, 'text') || parsed.positionals[1]

        if (!rawNodeId) {
          throw new Error('Missing node id. Pass --node <nodeId>')
        }
        if (!text) {
          throw new Error('Missing text. Pass --text <value>')
        }

        const nodeId = Number.parseInt(rawNodeId, 10)
        if (Number.isNaN(nodeId)) {
          throw new Error(`Invalid node id: ${rawNodeId}`)
        }

        const tabId = await resolveTabId(
          manager,
          profileId,
          getStringOption(parsed, 'tab'),
        )

        const { result } = await manager.callTool(
          profileId,
          'browser_type_text',
          { tabId, nodeId, text },
        )

        printValue(result, hasFlag(parsed, 'json', 'j'))
        return 0
      }

      case 'screenshot': {
        const parsed = parseArgs(
          [maybeSubcommand, ...rest].filter(Boolean) as string[],
        )
        const profileId = requireProfileOption(parsed)
        const tabId = await resolveTabId(
          manager,
          profileId,
          getStringOption(parsed, 'tab'),
        )

        const { result } = await manager.callTool(
          profileId,
          'browser_get_screenshot',
          { tabId, size: 'medium' },
        )

        const outputPath = getStringOption(parsed, 'output', 'o')
        if (outputPath) {
          const saved = await saveScreenshot(result, outputPath)
          printValue(saved, hasFlag(parsed, 'json', 'j'))
          return 0
        }

        printValue(result, hasFlag(parsed, 'json', 'j'))
        return 0
      }

      case 'context': {
        const parsed = parseArgs(
          [maybeSubcommand, ...rest].filter(Boolean) as string[],
        )
        const profileId = requireProfileOption(parsed)
        const explicitTabId = parseTabSpecifier(getStringOption(parsed, 'tab'))
        const context = await getPageContext(manager, profileId, {
          tabId: explicitTabId,
          includeLinks: hasFlag(parsed, 'links'),
          simplified: hasFlag(parsed, 'simplified'),
        })

        const payload = {
          tab: context.tab,
          pageText: context.pageText,
          elementsText: context.elementsText,
        }

        if (hasFlag(parsed, 'json', 'j')) {
          console.log(asJson(payload))
        } else {
          console.log(
            [
              `Active Tab: ${String(context.tab.title || '(untitled)')}`,
              `URL: ${String(context.tab.url || '')}`,
              '',
              'PAGE CONTENT',
              context.pageText,
              '',
              'INTERACTIVE ELEMENTS',
              context.elementsText,
            ].join('\n'),
          )
        }
        return 0
      }

      case 'tool': {
        if (maybeSubcommand !== 'call') {
          throw new Error('Unknown tool subcommand. Use: tool call')
        }

        const parsed = parseArgs(rest)
        const profileId = requireProfileOption(parsed)
        const toolName = parsed.positionals[0]
        if (!toolName) {
          throw new Error(
            'Missing tool name. Usage: tool call --profile <profileId> <toolName> [argsJson]',
          )
        }
        const argsJson =
          parsed.positionals[1] || getStringOption(parsed, 'args')
        const toolArgs = parseJsonArgs(argsJson)
        const { result } = await manager.callTool(profileId, toolName, toolArgs)
        printValue(result, hasFlag(parsed, 'json', 'j'))
        return 0
      }

      case 'mcp': {
        switch (maybeSubcommand) {
          case 'serve': {
            const parsed = parseArgs(rest)
            const defaultProfileId = getStringOption(parsed, 'profile', 'p')
            if (defaultProfileId) {
              const resolved = resolveProfileSelection(defaultProfileId)
              console.error(
                `zenctl MCP default profile: ${buildProfileSummary(resolved.profile)}`,
              )
            }

            const server = await createMcpServer(manager, defaultProfileId)
            const transport = new StdioServerTransport()

            const shutdown = async () => {
              await manager.close()
              await server.close().catch(() => {})
            }

            process.once('SIGINT', () => {
              void shutdown().finally(() => process.exit(0))
            })
            process.once('SIGTERM', () => {
              void shutdown().finally(() => process.exit(0))
            })

            await server.connect(transport)
            await new Promise<void>((resolve) => {
              process.stdin.once('close', resolve)
              process.stdin.resume()
            })
            await shutdown()
            return 0
          }

          case 'source-config': {
            const parsed = parseArgs(rest)
            const profileId = getStringOption(parsed, 'profile', 'p')
            const sourceName = getStringOption(parsed, 'name')
            const sourceConfig = buildSourceConfig(profileId, sourceName)
            const output = {
              source: sourceConfig,
              commandExample: `${sourceConfig.mcp.command} ${sourceConfig.mcp.args.join(' ')}`,
            }
            printValue(output, true)
            return 0
          }

          case 'install': {
            const parsed = parseArgs(rest)
            const profileId = getStringOption(parsed, 'profile', 'p')
            const sourceName = getStringOption(parsed, 'name')
            const workspaceRootPath =
              getStringOption(parsed, 'workspace', 'w') ||
              getDefaultWorkspaceRoot()

            if (!workspaceRootPath) {
              throw new Error(
                'Missing workspace. Pass --workspace <rootPath> or configure an active Craft workspace first.',
              )
            }

            const result = await installSource(
              workspaceRootPath,
              profileId,
              sourceName,
            )
            printValue(result, hasFlag(parsed, 'json', 'j'))
            return 0
          }

          default:
            throw new Error(
              'Unknown mcp subcommand. Use: mcp serve | mcp source-config | mcp install',
            )
        }
      }

      default:
        throw new Error(`Unknown command: ${command}`)
    }
  } finally {
    await manager.close()
  }
}

export async function runZenCtl(argv = process.argv.slice(2)): Promise<number> {
  try {
    return await runCliCommand(argv)
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    return 1
  }
}
