/**
 * Browser Tools
 *
 * Local tools for browser profile management that the BrowserAgent can invoke.
 * These tools operate on the local profile/proxy storage without needing MCP.
 */

import type { Tool as PiTool } from '@mariozechner/pi-ai'
import {
  listProfiles,
  createProfile,
  getProfile,
  updateProfile,
  deleteProfile,
} from '../browser-profiles/storage.ts'
import {
  launchBrowser,
  stopBrowser,
  isBrowserRunning,
  getRunningProfiles,
  stopAllBrowsers,
} from '../browser-profiles/launcher.ts'
import {
  listProxies,
  checkProxyHealth,
  checkAllProxiesHealth,
  importProxies,
} from '../browser-profiles/proxy-storage.ts'
import { generateFingerprint } from '../browser-profiles/fingerprint-generator.ts'
import type { CreateProfileInput } from '../browser-profiles/types.ts'

/**
 * All local browser management tools
 */
export const BROWSER_TOOLS: PiTool[] = [
  {
    name: 'profile_list',
    description: 'List all browser profiles with their status (running/idle), proxy, and fingerprint info',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'profile_create',
    description: 'Create a new browser profile with auto-generated fingerprint. Optionally specify name, platform (amazon/ebay/shopee/etc), proxy ID, and target region.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Profile name' },
        platform: { type: 'string', description: 'E-commerce platform: amazon, ebay, shopee, lazada, aliexpress, etsy, walmart, other' },
        proxyId: { type: 'string', description: 'Proxy pool ID to assign' },
        targetRegion: { type: 'string', description: 'Target region for fingerprint: us, eu, asia, oceania' },
        targetPlatform: { type: 'string', description: 'OS platform for fingerprint: windows, macos, linux' },
      },
    },
  },
  {
    name: 'profile_launch',
    description: 'Launch a browser profile by ID. Returns success status and PID.',
    parameters: {
      type: 'object',
      properties: {
        profileId: { type: 'string', description: 'Profile ID to launch' },
      },
      required: ['profileId'],
    },
  },
  {
    name: 'profile_stop',
    description: 'Stop a running browser profile by ID',
    parameters: {
      type: 'object',
      properties: {
        profileId: { type: 'string', description: 'Profile ID to stop' },
      },
      required: ['profileId'],
    },
  },
  {
    name: 'profile_stop_all',
    description: 'Stop all running browser profiles',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'profile_get_running',
    description: 'Get list of currently running profile IDs',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'proxy_list',
    description: 'List all proxies in the pool with their health status, geolocation, and usage count',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'proxy_health_check',
    description: 'Check health of a specific proxy or all proxies',
    parameters: {
      type: 'object',
      properties: {
        proxyId: { type: 'string', description: 'Specific proxy ID to check. Omit to check all.' },
      },
    },
  },
  {
    name: 'proxy_import',
    description: 'Import proxies from text. Supports formats: host:port, host:port:user:pass, type://host:port:user:pass',
    parameters: {
      type: 'object',
      properties: {
        lines: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of proxy strings to import',
        },
        region: { type: 'string', description: 'Region tag: us, eu, asia, oceania' },
        provider: { type: 'string', description: 'Provider name' },
      },
      required: ['lines'],
    },
  },
  {
    name: 'fingerprint_regenerate',
    description: 'Regenerate fingerprint for a profile, optionally matching proxy geolocation',
    parameters: {
      type: 'object',
      properties: {
        profileId: { type: 'string', description: 'Profile ID' },
        targetPlatform: { type: 'string', description: 'OS: windows, macos, linux' },
        targetRegion: { type: 'string', description: 'Region: us, eu, asia, oceania' },
      },
      required: ['profileId'],
    },
  },
]

/**
 * Execute a local browser tool and return the result as text
 */
export async function executeBrowserTool(
  toolName: string,
  args: Record<string, unknown>,
): Promise<{ text: string; isError: boolean }> {
  try {
    switch (toolName) {
      case 'profile_list': {
        const profiles = listProfiles()
        const running = getRunningProfiles()
        const summary = profiles.map((p) => ({
          id: p.id,
          name: p.name,
          status: running.includes(p.id) ? 'running' : 'idle',
          platform: p.platform || 'other',
          proxy: p.proxyId ? `proxy:${p.proxyId}` : 'none',
          os: p.fingerprint?.navigator?.platform || 'unknown',
          serialNumber: p.serialNumber,
        }))
        return { text: JSON.stringify(summary, null, 2), isError: false }
      }

      case 'profile_create': {
        const input: CreateProfileInput = {
          name: (args.name as string) || `Profile ${Date.now()}`,
          platform: args.platform as any,
          proxyId: args.proxyId as string | undefined,
          targetRegion: args.targetRegion as any,
          targetPlatform: args.targetPlatform as any,
        }
        const profile = createProfile(input)
        return { text: `Created profile "${profile.name}" (ID: ${profile.id})`, isError: false }
      }

      case 'profile_launch': {
        const profileId = args.profileId as string
        const profile = getProfile(profileId)
        if (!profile) return { text: `Profile not found: ${profileId}`, isError: true }
        const result = await launchBrowser(profile, { profileNumber: profile.serialNumber })
        if (result.success) {
          return { text: `Launched "${profile.name}" (PID: ${result.pid})`, isError: false }
        }
        return { text: `Failed to launch: ${result.error}`, isError: true }
      }

      case 'profile_stop': {
        const stopped = stopBrowser(args.profileId as string)
        return { text: stopped ? 'Profile stopped' : 'Profile was not running', isError: false }
      }

      case 'profile_stop_all': {
        stopAllBrowsers()
        return { text: 'All profiles stopped', isError: false }
      }

      case 'profile_get_running': {
        const running = getRunningProfiles()
        return { text: JSON.stringify(running), isError: false }
      }

      case 'proxy_list': {
        const proxies = listProxies()
        const summary = proxies.map((p) => ({
          id: p.id,
          name: p.name,
          type: p.type,
          host: p.host,
          port: p.port,
          status: p.status,
          responseTimeMs: p.responseTimeMs,
          region: p.region,
          country: p.geoLocation?.country,
          profileCount: p.profileCount,
        }))
        return { text: JSON.stringify(summary, null, 2), isError: false }
      }

      case 'proxy_health_check': {
        if (args.proxyId) {
          const result = await checkProxyHealth(args.proxyId as string)
          return { text: JSON.stringify(result, null, 2), isError: false }
        }
        const results = await checkAllProxiesHealth()
        return { text: JSON.stringify(results, null, 2), isError: false }
      }

      case 'proxy_import': {
        const result = importProxies(
          args.lines as string[],
          {
            region: args.region as any,
            provider: args.provider as string | undefined,
          },
        )
        return {
          text: `Imported ${result.success}/${result.total} proxies. ${result.failed} failed.`,
          isError: result.failed > 0,
        }
      }

      case 'fingerprint_regenerate': {
        const profile = getProfile(args.profileId as string)
        if (!profile) return { text: `Profile not found: ${args.profileId}`, isError: true }
        const fp = generateFingerprint({
          targetPlatform: (args.targetPlatform as any) || undefined,
          targetRegion: (args.targetRegion as any) || undefined,
        })
        updateProfile(profile.id, { fingerprint: fp })
        return { text: `Fingerprint regenerated for "${profile.name}"`, isError: false }
      }

      default:
        return { text: `Unknown tool: ${toolName}`, isError: true }
    }
  } catch (err) {
    return {
      text: `Error: ${err instanceof Error ? err.message : String(err)}`,
      isError: true,
    }
  }
}
