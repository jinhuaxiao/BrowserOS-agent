/**
 * Browser Launcher
 *
 * Launches browser instances with fingerprint injection and proxy configuration.
 */

import { type ChildProcess, execSync, spawn } from 'node:child_process'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { homedir, platform } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { getDefaultAccelerator } from './accelerator-storage.ts'
import {
  clearCustomBrowserPath as clearStoredBrowserPath,
  getBrowserConfig as getStoredBrowserConfig,
  loadBrowserConfig,
  setBrowserPath as setStoredBrowserPath,
} from './browser-config-storage.ts'
import {
  getBrowserOSConfigPath,
  writeBrowserOSConfigCached,
  writeZenConfig,
} from './browseros-config.ts'
import { getExtensionVersionCache } from './config-cache.ts'
import {
  injectCookiesViaCDP,
  loadCookiesFromProfile,
} from './cookie-storage.ts'
import {
  buildAndPackageFingerprintExtensionMV2,
  FINGERPRINT_MV2_EXT_ID,
  getExtensionPath,
  hasExtension,
} from './extension-builder.ts'
import { isGostAvailable } from './gost-binary.ts'
import {
  startGostForProfile,
  stopAllGost,
  stopGostForProfile,
} from './gost-manager.ts'
import {
  getNovaSellerExtensionsDir,
  isNovaSeller,
  NOVA_SELLER_ENV,
  NOVA_SELLER_FILES,
} from './nova-seller-config.ts'
import {
  loadRegisteredPorts,
  registerProfilePorts,
  unregisterProfilePorts,
} from './port-registry.ts'
import { getProxy, savedProxyToConfig } from './proxy-storage.ts'
import {
  getFingerprintConfigPath,
  getProfilePath,
  updateProfileStatus,
} from './storage.ts'
import type {
  BrowserConfig,
  BrowserProfileConfig,
  BrowserType,
  FingerprintConfig,
  LaunchResult,
  LaunchWithMcpOptions,
  LaunchWithMcpResult,
  ProxyConfig,
} from './types.ts'

/**
 * Resolve monorepo root directory.
 * Works in both Bun (import.meta.url) and Electron CJS bundle (__dirname/cwd).
 */
function resolveMonorepoRoot(): string {
  // Try import.meta.url first (works in ESM / Bun)
  try {
    const metaUrl = import.meta.url
    if (metaUrl?.startsWith('file:')) {
      const thisDir = dirname(fileURLToPath(metaUrl))
      // This file is at packages/craft-agents/packages/shared/src/browser-profiles/
      const root = join(thisDir, '..', '..', '..', '..', '..', '..')
      if (existsSync(join(root, 'package.json'))) return root
    }
  } catch {}
  // Fallback: walk up from cwd looking for monorepo root markers
  let dir = process.cwd()
  for (let i = 0; i < 10; i++) {
    if (
      existsSync(join(dir, 'packages', 'craft-agents')) &&
      existsSync(join(dir, 'package.json'))
    ) {
      return dir
    }
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return process.cwd()
}

/**
 * Browser executable paths by platform
 * Nova Seller browser executable paths by platform
 */
const BROWSER_PATHS: Record<string, string[]> = {
  darwin: [
    // Nova Seller (primary)
    '/Applications/Nova Seller.app/Contents/MacOS/Nova Seller',
    '/Applications/NovaSeller.app/Contents/MacOS/NovaSeller',
    // Nova Seller Dev (local development builds)
    `${homedir()}/Desktop/Nova Seller Dev.app/Contents/MacOS/Nova Seller Dev`,
    '/Applications/Nova Seller Dev.app/Contents/MacOS/Nova Seller Dev',
    // Zen Browser (Firefox-based fingerprint browser)
    '/Applications/Zen Browser.app/Contents/MacOS/zen',
    '/Applications/Now.app/Contents/MacOS/zen',
  ],
  linux: [
    '/usr/bin/nova-seller',
    '/usr/bin/novaseller',
    '/opt/nova-seller/nova-seller',
    '/usr/bin/zen-browser',
    '/opt/zen-browser/zen',
  ],
  win32: [
    'C:\\Program Files\\Nova Seller\\Nova Seller.exe',
    'C:\\Program Files\\NovaSeller\\NovaSeller.exe',
    'C:\\Program Files\\Zen Browser\\zen.exe',
  ],
}

/**
 * Track running browser processes
 */
const runningProcesses = new Map<string, ChildProcess>()

/**
 * Track fallback MCP sidecar processes (browseros_server)
 */
const mcpSidecarProcesses = new Map<string, ChildProcess>()

function stablePortFromProfileId(
  profileId: string,
  min: number,
  max: number,
): number {
  let hash = 0
  for (let i = 0; i < profileId.length; i++) {
    hash = (hash * 31 + profileId.charCodeAt(i)) >>> 0
  }
  const range = max - min + 1
  return min + (hash % range)
}

function readJsonObject(path: string): Record<string, unknown> | null {
  if (!existsSync(path)) return null
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf-8'))
    if (parsed && typeof parsed === 'object') {
      return parsed as Record<string, unknown>
    }
  } catch {
    // Ignore parse failures
  }
  return null
}

/**
 * Extract the major Chromium version from a browser executable.
 * Runs `browserPath --version` which outputs e.g. "BrowserOS 145.0.7755.45".
 * Returns the major version number (e.g. 145) or null if extraction fails.
 */
function getBrowserMajorVersion(browserPath: string): number | null {
  try {
    const output = execSync(`"${browserPath}" --version`, {
      timeout: 5000,
      encoding: 'utf-8',
    }).trim()
    const match = output.match(/(\d+)\.\d+\.\d+\.\d+/)
    if (match) {
      return Number.parseInt(match[1], 10)
    }
  } catch {
    // --version not supported or timed out
  }
  return null
}

/**
 * Extract the major version from a "Last Version" file in the user-data directory.
 * The file contains a version string like "145.0.7755.45".
 */
function getUserDataMajorVersion(userDataDir: string): number | null {
  const lastVersionPath = join(userDataDir, 'Last Version')
  if (!existsSync(lastVersionPath)) return null
  try {
    const version = readFileSync(lastVersionPath, 'utf-8').trim()
    const match = version.match(/^(\d+)\./)
    if (match) {
      return Number.parseInt(match[1], 10)
    }
  } catch {
    // Ignore read failures
  }
  return null
}

/**
 * Clean up incompatible database files when Chromium major version changes.
 *
 * When a user-data directory was created by a newer Chromium version and is
 * then opened by an older version, certain database migrations fail with
 * CHECK/DCHECK assertions causing an immediate crash (abort).
 *
 * This removes the specific database files that cause version-mismatch crashes.
 * Chromium recreates them automatically on startup. User data like cookies,
 * login sessions, and bookmarks are stored in separate files and are not affected.
 */
function cleanIncompatibleDatabases(
  userDataDir: string,
  browserMajor: number,
  dataMajor: number,
  logPrefix: string,
): void {
  console.log(
    `${logPrefix} Chromium version mismatch: browser v${browserMajor}, user-data v${dataMajor}. Cleaning incompatible databases.`,
  )
  cleanWebAppDatabases(userDataDir, logPrefix)
}

/**
 * Remove databases that cause version-mismatch crashes.
 *
 * Chromium's WebApp database uses a protobuf schema version that is NOT tied
 * to the major Chromium version. Different builds of the same major version
 * can still have incompatible schema versions (e.g., version 6 vs 3), which
 * triggers a FATAL CHECK in web_app_database.cc.
 *
 * Sync Data LevelDB stores the WebApp protobuf — it must be cleaned too.
 * Chromium recreates all of these on startup.
 */
function cleanWebAppDatabases(userDataDir: string, logPrefix: string): void {
  const defaultDir = join(userDataDir, 'Default')
  const filesToRemove = [
    join(defaultDir, 'Web Data'),
    join(defaultDir, 'Web Data-journal'),
  ]
  const dirsToRemove = [
    join(defaultDir, 'WebAppProvider'),
    join(defaultDir, 'databases'),
    join(defaultDir, 'Sync Data', 'LevelDB'),
    join(defaultDir, 'shared_proto_db'),
  ]

  for (const file of filesToRemove) {
    if (existsSync(file)) {
      try {
        unlinkSync(file)
        console.log(`${logPrefix} Removed: ${file}`)
      } catch (err) {
        console.warn(`${logPrefix} Failed to remove ${file}: ${err}`)
      }
    }
  }

  for (const dir of dirsToRemove) {
    if (existsSync(dir)) {
      try {
        rmSync(dir, { recursive: true, force: true })
        console.log(`${logPrefix} Removed: ${dir}`)
      } catch (err) {
        console.warn(`${logPrefix} Failed to remove ${dir}: ${err}`)
      }
    }
  }
}

function resolveBundledServerResourcesDir(browserPath: string): string | null {
  const currentPlatform = platform()

  if (currentPlatform === 'darwin') {
    if (browserPath.includes('/Contents/MacOS/')) {
      const appPath = browserPath.split('/Contents/MacOS/')[0]
      if (appPath) {
        const candidate = join(
          appPath,
          'Contents/Resources/BrowserOSServer/default/resources',
        )
        if (existsSync(candidate)) {
          return candidate
        }
      }
    }
  }

  return null
}

function resolveBrowserOSServerResourcesDir(
  userDataDir: string,
  browserPath: string,
  options?: { requireBinary?: boolean },
): string | null {
  const requireBinary = options?.requireBinary ?? true
  const isValidResourcesDir = (dir: string): boolean => {
    if (requireBinary) {
      return existsSync(join(dir, 'bin', 'browseros_server'))
    }
    return existsSync(dir)
  }

  const browserOsDir = join(userDataDir, '.browseros')
  const configPath = join(browserOsDir, 'server_config.json')
  const existingConfig = readJsonObject(configPath)
  const existingResources = (
    existingConfig?.directories as Record<string, unknown> | undefined
  )?.resources

  if (
    typeof existingResources === 'string' &&
    isValidResourcesDir(existingResources)
  ) {
    return existingResources
  }

  const currentVersionPath = join(browserOsDir, 'current_version')
  if (existsSync(currentVersionPath)) {
    try {
      const currentVersion = readFileSync(currentVersionPath, 'utf-8').trim()
      if (currentVersion) {
        const versionResources = join(
          browserOsDir,
          'versions',
          currentVersion,
          'resources',
        )
        if (isValidResourcesDir(versionResources)) {
          return versionResources
        }
      }
    } catch {
      // Ignore read failures
    }
  }

  const versionsDir = join(browserOsDir, 'versions')
  if (existsSync(versionsDir)) {
    try {
      const versions = readdirSync(versionsDir)
        .filter((v) => !v.startsWith('.'))
        .sort()
        .reverse()
      for (const version of versions) {
        const versionResources = join(versionsDir, version, 'resources')
        if (isValidResourcesDir(versionResources)) {
          return versionResources
        }
      }
    } catch {
      // Ignore directory scan failures
    }
  }

  // Fallback: reuse resources from other local profile directories.
  // This helps newly-created profiles bootstrap MCP when they do not yet have
  // a local .browseros/versions payload but another profile already does.
  const profileDir = dirname(userDataDir)
  const profilesRoot = dirname(profileDir)
  if (existsSync(profilesRoot)) {
    try {
      const siblings = readdirSync(profilesRoot)
        .filter(
          (name) =>
            !name.startsWith('.') &&
            !['groups', 'proxies', 'templates'].includes(name),
        )
        .sort()

      for (const sibling of siblings) {
        const siblingUserDataDir = join(profilesRoot, sibling, 'user-data')
        if (
          siblingUserDataDir === userDataDir ||
          !existsSync(siblingUserDataDir)
        ) {
          continue
        }

        const siblingBrowserOsDir = join(siblingUserDataDir, '.browseros')
        const siblingCurrentVersionPath = join(
          siblingBrowserOsDir,
          'current_version',
        )

        if (existsSync(siblingCurrentVersionPath)) {
          try {
            const siblingCurrentVersion = readFileSync(
              siblingCurrentVersionPath,
              'utf-8',
            ).trim()
            if (siblingCurrentVersion) {
              const siblingVersionResources = join(
                siblingBrowserOsDir,
                'versions',
                siblingCurrentVersion,
                'resources',
              )
              if (isValidResourcesDir(siblingVersionResources)) {
                return siblingVersionResources
              }
            }
          } catch {
            // Ignore sibling current_version read failures
          }
        }

        const siblingVersionsDir = join(siblingBrowserOsDir, 'versions')
        if (!existsSync(siblingVersionsDir)) {
          continue
        }

        try {
          const siblingVersions = readdirSync(siblingVersionsDir)
            .filter((v) => !v.startsWith('.'))
            .sort()
            .reverse()

          for (const version of siblingVersions) {
            const siblingVersionResources = join(
              siblingVersionsDir,
              version,
              'resources',
            )
            if (isValidResourcesDir(siblingVersionResources)) {
              return siblingVersionResources
            }
          }
        } catch {
          // Ignore sibling versions scan failures
        }
      }
    } catch {
      // Ignore sibling profile scan failures
    }
  }

  const bundledResources = resolveBundledServerResourcesDir(browserPath)
  if (bundledResources && isValidResourcesDir(bundledResources)) {
    return bundledResources
  }

  return null
}

function isTcpPortInUse(port: number): boolean {
  if (!Number.isInteger(port) || port <= 0) {
    return true
  }

  try {
    execSync(`lsof -nP -iTCP:${port} -sTCP:LISTEN`, { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

function pickAvailablePort(
  preferredPort: number,
  minPort: number,
  maxPort: number,
  reserved: Set<number>,
): number {
  const span = maxPort - minPort + 1
  const normalized =
    preferredPort >= minPort && preferredPort <= maxPort
      ? preferredPort
      : minPort + (Math.abs(preferredPort) % span)

  for (let i = 0; i < span; i++) {
    const candidate = minPort + ((normalized - minPort + i) % span)
    if (reserved.has(candidate)) {
      continue
    }
    if (!isTcpPortInUse(candidate)) {
      reserved.add(candidate)
      return candidate
    }
  }

  reserved.add(normalized)
  return normalized
}

function ensureBrowserOSServerRuntimeConfig(
  profile: BrowserProfileConfig,
  browserPath: string,
): {
  host: string
  mcpPort: number
  cdpPort: number
  serverPort: number
  extensionPort: number
} | null {
  const localStatePath = join(profile.userDataDir, 'Local State')
  const localState = readJsonObject(localStatePath) ?? {}

  const browseros =
    localState.browseros && typeof localState.browseros === 'object'
      ? (localState.browseros as Record<string, unknown>)
      : {}
  const server =
    browseros.server && typeof browseros.server === 'object'
      ? (browseros.server as Record<string, unknown>)
      : {}

  // If the browser is already running on the configured proxy port,
  // return existing config without re-allocating (prevents port drift)
  const existingProxyPort =
    typeof server.proxy_port === 'number' ? server.proxy_port : null
  if (existingProxyPort && isTcpPortInUse(existingProxyPort)) {
    const host = profile.mcp?.host || '127.0.0.1'
    const existingCdpPort =
      typeof server.cdp_port === 'number'
        ? server.cdp_port
        : stablePortFromProfileId(profile.id, 9000, 9099)
    const existingServerPort =
      typeof server.server_port === 'number'
        ? server.server_port
        : stablePortFromProfileId(profile.id, 9200, 9299)
    const existingExtensionPort =
      typeof server.extension_port === 'number'
        ? server.extension_port
        : stablePortFromProfileId(profile.id, 9300, 9399)

    // Sync server_config.json ports to match actual running ports
    // (fixes drift if a previous call overwrote with wrong ports)
    const browserOsDir = join(profile.userDataDir, '.browseros')
    const serverConfigPath = join(browserOsDir, 'server_config.json')
    const existingServerConfig = readJsonObject(serverConfigPath)
    if (existingServerConfig) {
      const configPorts = existingServerConfig.ports as
        | Record<string, unknown>
        | undefined
      if (
        configPorts &&
        (configPorts.proxy !== existingProxyPort ||
          configPorts.http_mcp !== existingProxyPort)
      ) {
        configPorts.proxy = existingProxyPort
        configPorts.http_mcp = existingProxyPort
        configPorts.cdp = existingCdpPort
        configPorts.server = existingServerPort
        configPorts.extension = existingExtensionPort
        try {
          writeFileSync(serverConfigPath, JSON.stringify(existingServerConfig))
        } catch {
          // Best-effort sync
        }
      }
    }

    return {
      host,
      mcpPort: existingProxyPort,
      cdpPort: existingCdpPort,
      serverPort: existingServerPort,
      extensionPort: existingExtensionPort,
    }
  }

  const preferredProxyPort =
    profile.mcp?.port ??
    (typeof server.mcp_port === 'number'
      ? server.mcp_port
      : stablePortFromProfileId(profile.id, 9100, 9199))
  const preferredCdpPort = stablePortFromProfileId(profile.id, 9000, 9099)
  const preferredServerPort = stablePortFromProfileId(profile.id, 9200, 9299)
  const preferredExtensionPort = stablePortFromProfileId(profile.id, 9300, 9399)

  const reservedPorts = loadRegisteredPorts(profile.id)

  const proxyPort = pickAvailablePort(
    preferredProxyPort,
    9100,
    9199,
    reservedPorts,
  )
  const cdpPort = pickAvailablePort(preferredCdpPort, 9000, 9099, reservedPorts)
  const serverPort = pickAvailablePort(
    preferredServerPort,
    9200,
    9299,
    reservedPorts,
  )
  const extensionPort = pickAvailablePort(
    preferredExtensionPort,
    9300,
    9399,
    reservedPorts,
  )
  const allowRemote =
    typeof server.allow_remote_in_mcp === 'boolean'
      ? server.allow_remote_in_mcp
      : false
  const serverVersion =
    typeof server.version === 'string' ? server.version : '0.0.52'

  server.proxy_port = proxyPort
  server.server_port = serverPort
  server.mcp_port = proxyPort
  server.cdp_port = cdpPort
  server.extension_port = extensionPort
  server.allow_remote_in_mcp = allowRemote
  server.restart_requested = true
  server.version = serverVersion
  browseros.server = server
  localState.browseros = browseros

  try {
    writeFileSync(localStatePath, JSON.stringify(localState))
  } catch (err) {
    console.warn(
      `[Launcher] Failed to write BrowserOS server preferences: ${err}`,
    )
  }

  // Compatibility: some BrowserOS/Nova Seller builds may read getPref()
  // values from profile Preferences instead of Local State.
  const profilePreferencesPath = join(
    profile.userDataDir,
    'Default',
    'Preferences',
  )
  const profilePreferences = readJsonObject(profilePreferencesPath) ?? {}
  const profileBrowseros =
    profilePreferences.browseros &&
    typeof profilePreferences.browseros === 'object'
      ? (profilePreferences.browseros as Record<string, unknown>)
      : {}
  const profileServer =
    profileBrowseros.server && typeof profileBrowseros.server === 'object'
      ? (profileBrowseros.server as Record<string, unknown>)
      : {}

  profileServer.proxy_port = proxyPort
  profileServer.server_port = serverPort
  profileServer.mcp_port = proxyPort
  profileServer.cdp_port = cdpPort
  profileServer.extension_port = extensionPort
  profileServer.allow_remote_in_mcp = allowRemote
  profileServer.restart_requested = true
  profileServer.version = serverVersion
  profileBrowseros.server = profileServer
  profilePreferences.browseros = profileBrowseros

  try {
    writeFileSync(profilePreferencesPath, JSON.stringify(profilePreferences))
  } catch (err) {
    console.warn(
      `[Launcher] Failed to write BrowserOS profile preferences: ${err}`,
    )
  }

  const browserOsDir = join(profile.userDataDir, '.browseros')
  if (!existsSync(browserOsDir)) {
    mkdirSync(browserOsDir, { recursive: true })
  }

  const serverConfigPath = join(browserOsDir, 'server_config.json')
  const existingServerConfig = readJsonObject(serverConfigPath)
  let resourcesDir = resolveBrowserOSServerResourcesDir(
    profile.userDataDir,
    browserPath,
    {
      requireBinary: true,
    },
  )
  if (!resourcesDir) {
    // Fallback: accept resources dir without binary (for bun-based sidecar)
    resourcesDir = resolveBrowserOSServerResourcesDir(
      profile.userDataDir,
      browserPath,
      {
        requireBinary: false,
      },
    )
  }

  let browserVersion = ''
  const lastVersionPath = join(profile.userDataDir, 'Last Version')
  if (existsSync(lastVersionPath)) {
    try {
      browserVersion = readFileSync(lastVersionPath, 'utf-8').trim()
    } catch {
      // Ignore read failures
    }
  }

  const installId =
    typeof browseros.metrics_install_id === 'string'
      ? browseros.metrics_install_id
      : (((
          existingServerConfig?.instance as Record<string, unknown> | undefined
        )?.install_id as string | undefined) ?? '')

  const serverConfig = {
    directories: {
      execution: browserOsDir,
      resources: resourcesDir || browserOsDir,
    },
    flags: {
      allow_remote_in_mcp: allowRemote,
    },
    instance: {
      browseros_version: browserVersion,
      chromium_version: browserVersion,
      install_id: installId,
    },
    ports: {
      cdp: cdpPort,
      extension: extensionPort,
      server: serverPort,
      proxy: proxyPort,
      http_mcp: proxyPort,
    },
  }

  try {
    writeFileSync(serverConfigPath, JSON.stringify(serverConfig))
  } catch (err) {
    console.warn(`[Launcher] Failed to write BrowserOS server config: ${err}`)
  }

  registerProfilePorts(profile.id, {
    proxy: proxyPort,
    cdp: cdpPort,
    server: serverPort,
    extension: extensionPort,
    pid: 0,
    updatedAt: Date.now(),
  })

  return {
    host: profile.mcp?.host || '127.0.0.1',
    mcpPort: proxyPort,
    cdpPort,
    serverPort,
    extensionPort,
  }
}

async function isMcpHttpAvailable(
  host: string,
  port: number,
): Promise<boolean> {
  const endpoints = [`http://${host}:${port}/health`, `http://${host}:${port}/`]

  for (const endpoint of endpoints) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 1000)
      const response = await fetch(endpoint, {
        method: 'GET',
        signal: controller.signal,
      })
      clearTimeout(timeoutId)
      if (response.ok || response.status < 500) {
        return true
      }
    } catch {
      // Try next endpoint
    }
  }

  return false
}

async function waitForMcpHttpAvailable(
  host: string,
  port: number,
  timeoutMs: number,
): Promise<boolean> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (await isMcpHttpAvailable(host, port)) {
      return true
    }
    await new Promise((resolve) => setTimeout(resolve, 400))
  }
  return false
}

function stopMcpSidecar(profileId: string): void {
  const sidecar = mcpSidecarProcesses.get(profileId)
  if (!sidecar) {
    return
  }

  try {
    sidecar.kill('SIGTERM')
  } catch {
    // Ignore termination failures
  }
  mcpSidecarProcesses.delete(profileId)
}

async function ensureMcpSidecarForProfile(
  profile: BrowserProfileConfig,
  browserPath: string,
  logPrefix: string,
): Promise<void> {
  const runtimeConfig = ensureBrowserOSServerRuntimeConfig(profile, browserPath)
  if (!runtimeConfig) {
    console.warn(
      `${logPrefix} BrowserOS server resources not found for profile ${profile.id}`,
    )
    return
  }

  const { host, mcpPort } = runtimeConfig

  // If browser already started MCP server, no fallback needed.
  if (await waitForMcpHttpAvailable(host, mcpPort, 8000)) {
    return
  }

  const existing = mcpSidecarProcesses.get(profile.id)
  if (existing && !existing.killed) {
    if (await waitForMcpHttpAvailable(host, mcpPort, 6000)) {
      return
    }
  }

  const resourcesDir = resolveBrowserOSServerResourcesDir(
    profile.userDataDir,
    browserPath,
    {
      requireBinary: true,
    },
  )
  const serverBinary = resourcesDir
    ? join(resourcesDir, 'bin', 'browseros_server')
    : null
  const serverConfigPath = join(
    profile.userDataDir,
    '.browseros',
    'server_config.json',
  )

  if (!existsSync(serverConfigPath)) {
    console.warn(
      `${logPrefix} Unable to start MCP fallback sidecar (missing server config)`,
    )
    return
  }

  const hasBinary = serverBinary && existsSync(serverBinary)
  let sidecarCommand: string
  let sidecarArgs: string[]

  if (hasBinary) {
    sidecarCommand = serverBinary
    sidecarArgs = ['--config', serverConfigPath]
  } else {
    // Fallback: launch MCP server from source using bun
    const monorepoRoot = resolveMonorepoRoot()
    const serverEntry = join(monorepoRoot, 'apps', 'server', 'src', 'index.ts')
    if (!existsSync(serverEntry)) {
      console.warn(
        `${logPrefix} Unable to start MCP sidecar (no binary and no source at ${serverEntry})`,
      )
      return
    }
    sidecarCommand = 'bun'
    sidecarArgs = ['run', serverEntry, '--config', serverConfigPath]
    console.log(
      `${logPrefix} Binary not found, falling back to bun source sidecar`,
    )
  }

  try {
    const sidecar = spawn(sidecarCommand, sidecarArgs, {
      env: { ...process.env },
      detached: true,
      stdio: 'ignore',
    })
    sidecar.unref()
    mcpSidecarProcesses.set(profile.id, sidecar)
    sidecar.on('exit', () => {
      mcpSidecarProcesses.delete(profile.id)
    })
  } catch (err) {
    console.warn(`${logPrefix} Failed to launch MCP fallback sidecar: ${err}`)
    return
  }

  if (await waitForMcpHttpAvailable(host, mcpPort, 12000)) {
    console.log(
      `${logPrefix} MCP fallback sidecar is ready on ${host}:${mcpPort}`,
    )
  } else {
    console.warn(
      `${logPrefix} MCP sidecar started but MCP endpoint is still unavailable on ${host}:${mcpPort}`,
    )
  }
}

/**
 * Check if the browser is a custom fingerprint browser (Nova Seller or BrowserOS)
 * These browsers have built-in anti-detection features and don't support
 * some Chrome-specific flags like --disable-blink-features=AutomationControlled
 */
function isCustomFingerprintBrowser(browserPath: string): boolean {
  const lowerPath = browserPath.toLowerCase()
  return (
    lowerPath.includes('nova seller') ||
    lowerPath.includes('novaseller') ||
    lowerPath.includes('nova-seller') ||
    lowerPath.includes('browseros') ||
    isZenBrowser(browserPath)
  )
}

function isZenBrowser(browserPath: string): boolean {
  const lowerPath = browserPath.toLowerCase()
  return (
    lowerPath.includes('zen browser') ||
    lowerPath.includes('zen-browser') ||
    (lowerPath.includes('nightly') && lowerPath.endsWith('/zen')) ||
    (lowerPath.endsWith('/zen') && !lowerPath.includes('chrome'))
  )
}

/**
 * Check if the browser is BrowserOS based on executable path
 * @deprecated Use isCustomFingerprintBrowser instead
 */
function isBrowserOS(browserPath: string): boolean {
  return isCustomFingerprintBrowser(browserPath)
}

function ensureLanguagePreferences(profile: BrowserProfileConfig): void {
  // Chromium's intl.accept_languages only accepts plain language codes (e.g. "en-US,en").
  // It MUST NOT contain HTTP quality weights like ";q=0.9" or any semicolons/spaces,
  // as Chromium's http_util.cc will DCHECK/crash on them.
  // Always use the plain languages list, never acceptLanguage which may have weights.
  const acceptLanguage = profile.fingerprint.navigator.languages.join(',')
  const selectedLanguages = profile.fingerprint.navigator.languages.join(',')
  const primaryLanguage = profile.fingerprint.navigator.language
  const preferencesPath = join(profile.userDataDir, 'Default', 'Preferences')

  try {
    const preferencesDir = dirname(preferencesPath)
    if (!existsSync(preferencesDir)) {
      mkdirSync(preferencesDir, { recursive: true })
    }

    let preferences: Record<string, unknown> = {}
    if (existsSync(preferencesPath)) {
      try {
        const parsed = JSON.parse(readFileSync(preferencesPath, 'utf-8'))
        if (parsed && typeof parsed === 'object') {
          preferences = parsed as Record<string, unknown>
        }
      } catch {
        preferences = {}
      }
    }

    const intl =
      preferences.intl && typeof preferences.intl === 'object'
        ? (preferences.intl as Record<string, unknown>)
        : {}
    intl.accept_languages = acceptLanguage
    intl.selected_languages = selectedLanguages
    if (primaryLanguage) {
      intl.app_locale = primaryLanguage
    }
    preferences.intl = intl

    writeFileSync(preferencesPath, JSON.stringify(preferences, null, 2))
  } catch {
    // Best-effort only; preferences will fall back to command-line flags.
  }
}

/**
 * Get the BrowserOS extensions directory path
 * Returns null if the extensions directory doesn't exist
 */
function getBrowserOSExtensionsDir(browserPath: string): string | null {
  const currentPlatform = platform()

  if (currentPlatform === 'darwin') {
    // macOS: Strip the binary name from the path to get the .app root
    const appPath = browserPath.replace(/\/Contents\/MacOS\/[^/]+$/, '')

    // Try BrowserOS Framework first
    const frameworkPath = join(
      appPath,
      'Contents/Frameworks/BrowserOS Framework.framework/Versions',
    )
    if (existsSync(frameworkPath)) {
      const currentPath = join(
        frameworkPath,
        'Current/Resources/browseros_extensions',
      )
      if (existsSync(currentPath)) {
        return currentPath
      }
      try {
        const versions = readdirSync(frameworkPath).filter(
          (v) => !v.startsWith('.') && v !== 'Current',
        )
        for (const version of versions) {
          const extPath = join(
            frameworkPath,
            version,
            'Resources/browseros_extensions',
          )
          if (existsSync(extPath)) {
            return extPath
          }
        }
      } catch {
        // Continue to Nova Seller Framework fallback
      }
    }

    // Try Nova Seller Framework
    const novaFrameworkPath = join(
      appPath,
      'Contents/Frameworks/Nova Seller Framework.framework/Versions',
    )
    if (existsSync(novaFrameworkPath)) {
      const currentPath = join(
        novaFrameworkPath,
        'Current/Resources/browseros_extensions',
      )
      if (existsSync(currentPath)) {
        return currentPath
      }
      try {
        const versions = readdirSync(novaFrameworkPath).filter(
          (v) => !v.startsWith('.') && v !== 'Current',
        )
        for (const version of versions) {
          const extPath = join(
            novaFrameworkPath,
            version,
            'Resources/browseros_extensions',
          )
          if (existsSync(extPath)) {
            return extPath
          }
        }
      } catch {
        return null
      }
    }

    return null
  } else if (currentPlatform === 'linux') {
    // Linux: /opt/browseros/resources/browseros_extensions/ or similar
    const possiblePaths = [
      '/opt/browseros/resources/browseros_extensions',
      '/usr/share/browseros/resources/browseros_extensions',
    ]
    for (const p of possiblePaths) {
      if (existsSync(p)) {
        return p
      }
    }
  } else if (currentPlatform === 'win32') {
    // Windows: installation directory/resources/browseros_extensions/
    const appDir = dirname(browserPath)
    const extPath = join(appDir, 'resources', 'browseros_extensions')
    if (existsSync(extPath)) {
      return extPath
    }
  }

  return null
}

/**
 * Extension info from bundled_extensions.json
 */
interface BundledExtension {
  external_crx: string
  external_version: string
}

/**
 * Extract CRX file to a directory
 * CRX files are ZIP files with a header, so we can use unzip after stripping the header
 */
function extractCrx(crxPath: string, outputDir: string): boolean {
  try {
    // Create output directory
    mkdirSync(outputDir, { recursive: true })

    // CRX3 format: magic(4) + version(4) + header_length(4) + header + zip_content
    // We need to find where the ZIP content starts and extract from there
    // For simplicity, we use a shell command to find the PK header and extract
    try {
      // Use unzip with -o (overwrite) and skip invalid extra field warnings
      // The trick is to find the ZIP signature (PK\x03\x04) and start from there
      execSync(
        `unzip -o -q "${crxPath}" -d "${outputDir}" 2>/dev/null || true`,
        { stdio: 'pipe' },
      )

      // Check if manifest.json exists (indicator of successful extraction)
      if (existsSync(join(outputDir, 'manifest.json'))) {
        return true
      }

      // If direct unzip failed, try finding the ZIP signature and extracting
      // CRX3 header is variable length, so we search for the ZIP signature (PK\x03\x04)
      const crxData = readFileSync(crxPath)

      let zipStart = -1
      for (let i = 0; i < Math.min(crxData.length, 10000); i++) {
        if (
          crxData[i] === 0x50 && // 'P'
          crxData[i + 1] === 0x4b && // 'K'
          crxData[i + 2] === 0x03 && // version needed
          crxData[i + 3] === 0x04 // local file header
        ) {
          zipStart = i
          break
        }
      }

      if (zipStart === -1) {
        console.warn(
          `[Nova Seller] Could not find ZIP signature in CRX: ${crxPath}`,
        )
        return false
      }

      // Extract ZIP portion and write to temp file
      const zipData = crxData.slice(zipStart)
      const tempZipPath = join(outputDir, '_temp.zip')
      writeFileSync(tempZipPath, zipData)

      // Extract the temp zip
      execSync(`unzip -o -q "${tempZipPath}" -d "${outputDir}"`, {
        stdio: 'pipe',
      })

      // Clean up temp file
      try {
        require('node:fs').unlinkSync(tempZipPath)
      } catch {
        // Ignore cleanup errors
      }

      return existsSync(join(outputDir, 'manifest.json'))
    } catch (err) {
      console.warn(
        `[Nova Seller] Failed to extract CRX ${basename(crxPath)}:`,
        err,
      )
      return false
    }
  } catch (err) {
    console.warn(
      `[Nova Seller] Failed to create output directory for ${basename(crxPath)}:`,
      err,
    )
    return false
  }
}

/**
 * Write version file to track extracted extension version
 */
function writeVersionFile(extOutputDir: string, version: string): void {
  try {
    writeFileSync(join(extOutputDir, '.version'), version, 'utf-8')
  } catch {
    // Ignore version file write errors
  }
}

/**
 * Read version file from extracted extension directory
 */
function readVersionFile(extOutputDir: string): string | null {
  try {
    const versionPath = join(extOutputDir, '.version')
    if (existsSync(versionPath)) {
      return readFileSync(versionPath, 'utf-8').trim()
    }
  } catch {
    // Ignore read errors
  }
  return null
}

/**
 * Setup custom browser extensions in user-data-dir
 * Works with both Nova Seller and BrowserOS
 * Extracts CRX files to the user data directory for loading with --load-extension
 * Returns an array of paths to unpacked extension directories
 *
 * Performance optimization:
 * - Checks .version file to skip extraction if version matches
 * - Uses in-memory version cache for faster lookups
 */
const BLOCKED_EXTENSION_IDS = [
  'adlpneommgkgeanpaekgoaolcpncohkf', // BrowserOS Feedback
]

function cleanupBlockedExtensions(
  userDataDir: string,
  logPrefix: string,
): void {
  for (const extId of BLOCKED_EXTENSION_IDS) {
    // Clean from Chrome's installed extensions directory
    const chromeExtDir = join(userDataDir, 'Default', 'Extensions', extId)
    if (existsSync(chromeExtDir)) {
      rmSync(chromeExtDir, { recursive: true, force: true })
      console.log(
        `${logPrefix} Removed blocked extension from Default/Extensions: ${extId}`,
      )
    }

    // Clean from BrowserOS Extensions directory (unpacked copies)
    const browserOsExtDir = join(userDataDir, 'BrowserOS Extensions')
    if (existsSync(browserOsExtDir)) {
      try {
        const entries = readdirSync(browserOsExtDir)
        for (const entry of entries) {
          if (entry.startsWith(extId)) {
            const entryPath = join(browserOsExtDir, entry)
            rmSync(entryPath, { recursive: true, force: true })
            console.log(
              `${logPrefix} Removed blocked extension from BrowserOS Extensions: ${entry}`,
            )
          }
        }
      } catch {
        // Ignore scan failures
      }
    }
  }
}

function setupCustomBrowserExtensions(
  userDataDir: string,
  browserPath: string,
): string[] {
  const extensionPaths: string[] = []
  const isNova = isNovaSeller(browserPath)
  const logPrefix = isNova ? '[Nova Seller]' : '[BrowserOS]'
  const versionCache = getExtensionVersionCache()

  // Try Nova Seller extensions first, then fallback to BrowserOS
  let extensionsDir = isNova ? getNovaSellerExtensionsDir(browserPath) : null
  if (!extensionsDir) {
    extensionsDir = getBrowserOSExtensionsDir(browserPath)
  }

  if (!extensionsDir) {
    // This is not a fatal error - the browser can still run without bundled extensions
    // But if the browser relies on these extensions for MCP/Agent functionality,
    // you may need to verify the browser's internal structure
    console.warn(
      `${logPrefix} Extensions directory not found for browser: ${browserPath}`,
    )
    console.warn(
      `${logPrefix} The browser will launch without bundled extensions (Agent, Controller, etc.)`,
    )
    console.warn(
      `${logPrefix} If this is unexpected, check that the browser has extensions bundled in its Resources directory`,
    )
    return extensionPaths
  }

  // Read bundled_extensions.json
  const bundledConfigPath = join(extensionsDir, 'bundled_extensions.json')
  if (!existsSync(bundledConfigPath)) {
    console.warn(`${logPrefix} bundled_extensions.json not found`)
    return extensionPaths
  }

  let bundledExtensions: Record<string, BundledExtension>
  try {
    bundledExtensions = JSON.parse(readFileSync(bundledConfigPath, 'utf-8'))
  } catch (err) {
    console.warn(`${logPrefix} Failed to parse bundled_extensions.json:`, err)
    return extensionPaths
  }

  // Create extensions directory in user-data-dir for unpacked extensions
  const unpackedExtDir = join(
    userDataDir,
    isNova ? NOVA_SELLER_FILES.extensionsDir : 'BrowserOS Extensions',
  )
  if (!existsSync(unpackedExtDir)) {
    mkdirSync(unpackedExtDir, { recursive: true })
  }

  // C++ ExternalProviderImpl already installs Agent/Controller as
  // kExternalComponent (hidden, non-removable) in both BrowserOS and Nova
  // Seller. Do not load them again via --load-extension to avoid duplicates.
  const ALLOWED_EXTENSION_IDS = new Set<string>()

  // Extract each CRX to its own directory
  for (const [extensionId, extConfig] of Object.entries(bundledExtensions)) {
    if (!ALLOWED_EXTENSION_IDS.has(extensionId)) {
      console.log(
        `${logPrefix} Skipping extension ${extensionId} (not in allowlist)`,
      )
      continue
    }
    const crxPath = join(extensionsDir, extConfig.external_crx)
    if (!existsSync(crxPath)) {
      console.warn(`${logPrefix} CRX file not found: ${crxPath}`)
      continue
    }

    // Create version-specific directory to handle updates
    const extOutputDir = join(
      unpackedExtDir,
      `${extensionId}_${extConfig.external_version}`,
    )

    // Check 1: In-memory version cache (fastest)
    if (
      versionCache.isCurrentVersion(
        extensionId,
        extConfig.external_version,
        extOutputDir,
      )
    ) {
      extensionPaths.push(extOutputDir)
      continue
    }

    // Check 2: .version file on disk
    const installedVersion = readVersionFile(extOutputDir)
    if (
      installedVersion === extConfig.external_version &&
      existsSync(join(extOutputDir, 'manifest.json'))
    ) {
      // Version matches and manifest exists, skip extraction
      versionCache.recordVersion(
        extensionId,
        extConfig.external_version,
        extOutputDir,
      )
      extensionPaths.push(extOutputDir)
      continue
    }

    // Check 3: Fallback - check if manifest.json exists (legacy)
    if (existsSync(join(extOutputDir, 'manifest.json'))) {
      // Write version file for future checks
      writeVersionFile(extOutputDir, extConfig.external_version)
      versionCache.recordVersion(
        extensionId,
        extConfig.external_version,
        extOutputDir,
      )
      extensionPaths.push(extOutputDir)
      continue
    }

    // Extract CRX
    if (extractCrx(crxPath, extOutputDir)) {
      // Write version file after successful extraction
      writeVersionFile(extOutputDir, extConfig.external_version)
      versionCache.recordVersion(
        extensionId,
        extConfig.external_version,
        extOutputDir,
      )
      extensionPaths.push(extOutputDir)
      console.log(
        `${logPrefix} Extracted extension ${extensionId} to ${extOutputDir}`,
      )
    } else {
      console.warn(`${logPrefix} Failed to extract extension ${extensionId}`)
    }
  }

  return extensionPaths
}

/**
 * @deprecated Use setupCustomBrowserExtensions instead
 */
function _setupBrowserOSExtensions(
  userDataDir: string,
  browserPath: string,
): string[] {
  return setupCustomBrowserExtensions(userDataDir, browserPath)
}

/**
 * Environment variable for custom browser path
 * Set CRAFT_BROWSER_PATH to override browser auto-detection
 */
const BROWSER_PATH_ENV = 'CRAFT_BROWSER_PATH'

/**
 * Environment variable for browser type
 * Set CRAFT_BROWSER_TYPE to specify browser type (nova-seller, browseros, chrome, chromium)
 */
const BROWSER_TYPE_ENV = 'CRAFT_BROWSER_TYPE'

/**
 * Find an available browser executable
 *
 * Priority order:
 * 1. CRAFT_BROWSER_PATH environment variable
 * 2. Custom browser path from passed config
 * 3. Custom browser path from stored config
 * 4. Default paths in BROWSER_PATHS (filtered by CRAFT_BROWSER_TYPE if set)
 * 5. PATH environment variable lookup
 *
 * @param config - Optional browser configuration with custom path
 */
export function findBrowserExecutable(config?: BrowserConfig): string | null {
  const currentPlatform = platform()

  // Priority 0: Environment variable (highest priority)
  const envBrowserPath = process.env[BROWSER_PATH_ENV]
  if (envBrowserPath && existsSync(envBrowserPath)) {
    return envBrowserPath
  }

  // Load stored config for custom path
  const storedConfig = loadBrowserConfig()

  // Get browser type from env or config
  const envBrowserType = process.env[BROWSER_TYPE_ENV] as
    | BrowserType
    | undefined

  // Priority 1: Custom path from passed config
  if (config?.customBrowserPath && existsSync(config.customBrowserPath)) {
    return config.customBrowserPath
  }

  // If passed config says custom only but path doesn't exist, fail early
  if (config?.useCustomPathOnly && config?.customBrowserPath) {
    console.warn(
      `[Launcher] Custom browser path not found: ${config.customBrowserPath}`,
    )
    return null
  }

  // Priority 2: Custom path from stored config
  if (
    storedConfig.customBrowserPath &&
    existsSync(storedConfig.customBrowserPath)
  ) {
    return storedConfig.customBrowserPath
  }

  // If stored config says custom only but path doesn't exist, fail early
  if (storedConfig.useCustomPathOnly && storedConfig.customBrowserPath) {
    console.warn(
      `[Launcher] Stored custom browser path not found: ${storedConfig.customBrowserPath}`,
    )
    return null
  }

  // Priority 3: Default paths in BROWSER_PATHS
  // Filter by browser type if specified (env > config > stored)
  const browserType =
    envBrowserType || config?.browserType || storedConfig.browserType
  let paths = BROWSER_PATHS[currentPlatform] ?? BROWSER_PATHS.linux ?? []

  if (browserType && browserType !== 'auto') {
    paths = filterPathsByBrowserType(paths, browserType)
  }

  for (const path of paths) {
    if (existsSync(path)) {
      return path
    }
  }

  // Priority 4: PATH environment variable lookup
  try {
    const cmd = currentPlatform === 'win32' ? 'where' : 'which'

    // Filter search names by browser type if specified
    let searchNames = ['nova-seller', 'novaseller']
    if (browserType && browserType !== 'auto') {
      searchNames = filterSearchNamesByBrowserType(searchNames, browserType)
    }

    for (const name of searchNames) {
      try {
        const result = execSync(`${cmd} ${name}`, { encoding: 'utf-8' }).trim()
        const firstLine = result.split('\n')[0]
        if (firstLine && existsSync(firstLine)) {
          return firstLine
        }
      } catch {}
    }
  } catch {
    // Ignore errors
  }

  return null
}

/**
 * Filter paths array by browser type
 */
function filterPathsByBrowserType(
  paths: string[],
  browserType: BrowserType,
): string[] {
  const typePatterns: Record<BrowserType, RegExp[]> = {
    'nova-seller': [/nova.?seller/i],
    browseros: [/browseros/i],
    'zen-browser': [/zen.?browser/i, /nightly.*\/zen$/i],
    chrome: [/google.?chrome/i, /chrome(?!ium)/i],
    chromium: [/chromium/i],
    auto: [], // No filtering
  }

  const patterns = typePatterns[browserType] || []
  if (patterns.length === 0) return paths

  return paths.filter((p) => patterns.some((pattern) => pattern.test(p)))
}

/**
 * Filter search names by browser type
 */
function filterSearchNamesByBrowserType(
  names: string[],
  browserType: BrowserType,
): string[] {
  const typeNames: Record<BrowserType, string[]> = {
    'nova-seller': ['nova-seller', 'novaseller'],
    browseros: ['browseros'],
    'zen-browser': ['zen-browser', 'zen'],
    chrome: ['google-chrome', 'chrome'],
    chromium: ['chromium'],
    auto: names,
  }

  return typeNames[browserType] || names
}

/**
 * Set custom browser path (persisted)
 *
 * @param path - Path to browser executable
 * @param options - Additional options
 */
export function setBrowserPath(
  path: string,
  options?: {
    useCustomPathOnly?: boolean
    browserType?: BrowserType
  },
): void {
  setStoredBrowserPath(path, options)
}

/**
 * Clear custom browser path (revert to default discovery)
 */
export function clearCustomBrowserPath(): void {
  clearStoredBrowserPath()
}

/**
 * Get current browser configuration
 */
export function getBrowserConfig(): BrowserConfig {
  return getStoredBrowserConfig()
}

/**
 * Resolve proxy configuration from proxyId or embedded proxy
 * Priority: proxyId > embedded proxy > fingerprint proxy
 */
export function resolveProxyConfig(
  profile: BrowserProfileConfig,
): ProxyConfig | undefined {
  // First, try to resolve from proxy pool using proxyId
  if (profile.proxyId) {
    const savedProxy = getProxy(profile.proxyId)
    if (savedProxy) {
      return savedProxyToConfig(savedProxy)
    }
    // Proxy not found in pool, fall through to embedded proxy
  }

  // Backward compatibility: use embedded proxy or fingerprint proxy
  return profile.proxy || profile.fingerprint.proxy
}

function normalizeFingerprintForLaunch(
  profile: BrowserProfileConfig,
): FingerprintConfig {
  const proxy = resolveProxyConfig(profile)

  return {
    ...profile.fingerprint,
    proxy,
    webrtc: {
      ...profile.fingerprint.webrtc,
      disableWebRTC:
        Boolean(proxy) || Boolean(profile.fingerprint.webrtc.disableWebRTC),
    },
  }
}

/**
 * Build command line arguments for browser launch
 * @param extensionPaths - Optional array of paths to unpacked extensions to load (for BrowserOS)
 */
export function buildLaunchArgs(
  profile: BrowserProfileConfig,
  browserPath: string,
  extensionPaths: string[] = [],
  options?: { cdpPort?: number; effectiveProxyUrl?: string },
): string[] {
  const args = [browserPath]

  // User data directory for profile isolation
  // All browsers including BrowserOS use custom user-data-dir for profile isolation
  args.push(`--user-data-dir=${profile.userDataDir}`)

  // Load unpacked extensions (for BrowserOS with custom user-data-dir)
  if (extensionPaths.length > 0) {
    args.push(`--load-extension=${extensionPaths.join(',')}`)
  }

  // Fingerprint config file path
  const usingBrowserOS = isBrowserOS(browserPath)
  const fingerprintConfigPath = usingBrowserOS
    ? getBrowserOSConfigPath(profile.id)
    : getFingerprintConfigPath(profile.id)
  if (existsSync(fingerprintConfigPath)) {
    // Custom flag for BrowserOS/Nova Seller to load fingerprint config
    args.push(`--fingerprint-config=${fingerprintConfigPath}`)
  }

  // TLS profile for JA3/JA4 fingerprint consistency
  if (usingBrowserOS && profile.fingerprint.tlsProfile) {
    args.push(`--tls-profile=${profile.fingerprint.tlsProfile}`)
  }

  // DNS leak protection — force DNS-over-HTTPS
  const dnsConfig = profile.fingerprint.dns
  if (dnsConfig?.mode === 'doh' || dnsConfig?.mode === 'custom') {
    const dohUrls: Record<string, string> = {
      cloudflare: 'https://cloudflare-dns.com/dns-query',
      google: 'https://dns.google/dns-query',
      quad9: 'https://dns.quad9.net/dns-query',
    }
    const dohUrl =
      dnsConfig.customDohUrl || dohUrls[dnsConfig.dohProvider || 'cloudflare']
    if (dohUrl) {
      args.push(
        `--dns-over-https-templates=${dohUrl}`,
        '--dns-over-https-mode=secure',
      )
    }
  }

  // Disable server auto-updater to use bundled binary (avoid OTA bugs)
  if (usingBrowserOS) {
    args.push('--disable-browseros-server-updater')
  }

  // Port configuration (BrowserOS/Nova Seller only)
  // Pass all 4 port switches so C++ ApplyCommandLineOverrides() uses our allocated ports
  if (usingBrowserOS) {
    const serverConfigPath = join(
      profile.userDataDir,
      '.browseros',
      'server_config.json',
    )
    try {
      const serverConfig = JSON.parse(readFileSync(serverConfigPath, 'utf-8'))
      const ports = serverConfig?.ports
      if (ports) {
        if (typeof ports.proxy === 'number')
          args.push(`--browseros-proxy-port=${ports.proxy}`)
        if (typeof ports.server === 'number')
          args.push(`--browseros-server-port=${ports.server}`)
        if (typeof ports.extension === 'number')
          args.push(`--browseros-extension-port=${ports.extension}`)
        if (typeof ports.cdp === 'number')
          args.push(`--browseros-cdp-port=${ports.cdp}`)
      }
    } catch {
      // fallback: no port args, C++ will auto-detect
    }
  }

  // Enable CDP remote access for BrowserOS
  if (usingBrowserOS) {
    args.push('--remote-allow-origins=*')
  }

  // Proxy configuration - use gost accelerated URL if provided, otherwise resolve normally
  const proxy = resolveProxyConfig(profile)
  if (options?.effectiveProxyUrl) {
    args.push(`--proxy-server=${options.effectiveProxyUrl}`)
    args.push('--proxy-bypass-list=127.0.0.1;localhost;[::1]')
  } else if (proxy) {
    const proxyUrl = `${proxy.type}://${proxy.host}:${proxy.port}`
    args.push(`--proxy-server=${proxyUrl}`)
    args.push('--proxy-bypass-list=127.0.0.1;localhost;[::1]')
  }

  // User agent
  args.push(`--user-agent=${profile.fingerprint.navigator.userAgent}`)

  // Window size from screen config
  const { width, height } = profile.fingerprint.screen
  args.push(`--window-size=${width},${height}`)

  // WebRTC configuration
  if (Boolean(proxy) || profile.fingerprint.webrtc.disableWebRTC) {
    args.push('--disable-webrtc')
  }

  // Language configuration to ensure HTTP Accept-Language matches navigator.language
  // This prevents fingerprint detection sites from flagging language inconsistency
  const primaryLanguage = profile.fingerprint.navigator.language

  // --accept-lang only accepts plain language codes (e.g. "en-US,en"),
  // NOT the full HTTP Accept-Language format with quality weights (e.g. "en-US,en;q=0.9").
  // Chromium's http_util.cc DCHECK crashes if ';' or ' ' is present in the value.
  // Strip quality weights and use the plain languages list instead.
  const acceptLangCodes = profile.fingerprint.navigator.languages.join(',')

  args.push(`--lang=${primaryLanguage}`)
  args.push(`--accept-lang=${acceptLangCodes}`)

  // Mobile device emulation — enable touch events and set device scale factor
  if (profile.fingerprint.deviceType === 'mobile') {
    args.push(
      '--enable-touch-events',
      `--force-device-scale-factor=${profile.fingerprint.screen.devicePixelRatio}`,
    )
  }

  // Common flags (supported by all browsers)
  args.push(
    '--disable-infobars',
    '--no-first-run',
    '--no-default-browser-check',
  )

  // Chrome/Chromium-specific flags (not supported or not needed by BrowserOS)
  // BrowserOS has built-in anti-detection and these flags may cause warnings
  // or interfere with BrowserOS's internal Agent and MCP services
  if (!isBrowserOS(browserPath)) {
    args.push(
      '--disable-blink-features=AutomationControlled',
      '--disable-background-networking',
      '--disable-sync',
      '--disable-translate',
      '--metrics-recording-only',
      '--disable-features=TranslateUI',
    )
  }

  // Flags to control User-Agent Client Hints (helps prevent version detection)
  // HTTP Sec-CH-UA headers can leak the real browser version even when JS is overridden
  // BrowserOS handles UA-CH internally, so only disable for non-BrowserOS browsers.
  if (!usingBrowserOS) {
    args.push(
      '--disable-features=UserAgentClientHint,ClientHintsDPR,ClientHintsDeviceMemory,ClientHintsResourceWidth,ClientHintsViewportWidth,AcceptCHFrame',
    )
  }

  // Startup URL — generate health check bootstrap page
  // The bootstrap page runs network/IP/timezone/language/WebRTC checks,
  // then auto-redirects to the target URL on success.
  const targetUrl =
    profile.startupUrl || getDefaultPlatformUrl(profile.platform)

  let proxyIp = ''
  let proxyCountry = ''
  if (profile.proxyId) {
    const savedProxy = getProxy(profile.proxyId)
    proxyIp = savedProxy?.geoLocation?.ip || savedProxy?.host || ''
    proxyCountry = savedProxy?.geoLocation?.country || ''
  }

  const bootstrapUrl = createChromiumBootstrapUrl(profile.userDataDir, {
    profileId: profile.id,
    targetUrl,
    profileName: profile.name,
    profileIp: proxyIp,
    profileCountry: proxyCountry,
    expectedTimezone: profile.fingerprint.timezone.name,
    expectedLanguage: profile.fingerprint.navigator.language,
  })
  args.push(bootstrapUrl)

  return args
}

/**
 * Zen browser (Firefox-based) executable paths by platform
 */
const ZEN_BROWSER_PATHS: Record<string, string[]> = {
  darwin: [
    // Development build path (checked first to use latest patches)
    join(
      homedir(),
      'workplace/agent-platform/packages/zen-browser/upstream/engine/obj-aarch64-apple-darwin/dist/Now.app/Contents/MacOS/zen',
    ),
    '/Applications/Zen Browser.app/Contents/MacOS/zen',
    '/Applications/Now.app/Contents/MacOS/zen',
  ],
  linux: ['/usr/bin/zen-browser', '/opt/zen-browser/zen'],
  win32: ['C:\\Program Files\\Zen Browser\\zen.exe'],
}

function findZenBrowserExecutable(config?: BrowserConfig): string | null {
  if (config?.customBrowserPath && existsSync(config.customBrowserPath)) {
    return config.customBrowserPath
  }

  const currentPlatform = platform()
  const paths = ZEN_BROWSER_PATHS[currentPlatform] ?? []
  for (const p of paths) {
    if (existsSync(p)) {
      return p
    }
  }

  try {
    const cmd = currentPlatform === 'win32' ? 'where' : 'which'
    const result = execSync(`${cmd} zen`, { encoding: 'utf-8' }).trim()
    const firstLine = result.split('\n')[0]
    if (firstLine && existsSync(firstLine)) {
      return firstLine
    }
  } catch {}

  return null
}

async function launchZenBrowser(
  profile: BrowserProfileConfig,
  options?: LaunchBrowserOptions,
): Promise<LaunchResult> {
  const logPrefix = '[Zen Browser]'
  const browserPath = findZenBrowserExecutable(options?.browserConfig)
  if (!browserPath) {
    const error =
      'Zen Browser executable not found. Please install Zen Browser or set the path in browser settings.'
    updateProfileStatus(profile.id, 'error', { error })
    return { success: false, error }
  }

  // Firefox uses -profile for profile isolation
  const profileDir = join(profile.userDataDir, 'zen-profile')
  if (!existsSync(profileDir)) {
    mkdirSync(profileDir, { recursive: true })
  }

  // --- Step A: Install Controller Extension ---
  // Copy controller.xpi to profile extensions/ dir with extension ID as filename.
  // Firefox auto-loads .xpi files from the profile's extensions/ directory.
  installZenControllerExtension(profileDir, logPrefix)

  // --- Step A2: Install Fingerprint Extension (JS-level font/API spoofing) ---
  // Zen skips C++ font restriction (skipKernelFonts) so all fonts render correctly.
  // This MV2 extension spoofs document.fonts API to report only target platform fonts.
  try {
    const fingerprintXpiPath = await buildAndPackageFingerprintExtensionMV2(
      profile.fingerprint,
      getProfilePath(profile.id),
    )
    installZenExtension(
      profileDir,
      fingerprintXpiPath,
      FINGERPRINT_MV2_EXT_ID,
      logPrefix,
    )
  } catch (err) {
    console.warn(`${logPrefix} Failed to install fingerprint extension: ${err}`)
  }

  // Write CAMOU_CONFIG JSON
  let camouConfigJson = ''
  try {
    const configPath = writeZenConfig(profile.id, profile.fingerprint, {
      profileName: profile.name,
      platform: profile.platform,
    })
    camouConfigJson = readFileSync(configPath, 'utf-8')
    console.log(`${logPrefix} CAMOU_CONFIG written to: ${configPath}`)
  } catch (err) {
    console.warn(`${logPrefix} Failed to write CAMOU_CONFIG: ${err}`)
  }

  // --- Step B: Allocate MCP ports ---
  let mcpPort = stablePortFromProfileId(profile.id, 9100, 9199)
  // WebSocket port for Zen controller extension.
  // Uses 9400-9499 range to avoid conflicts with Chromium BrowserOS (9300-9399).
  let extensionPort = stablePortFromProfileId(profile.id, 9400, 9499)

  // Start MCP sidecar BEFORE browser to get actual ports (handles port conflicts)
  const actualPorts = await ensureZenMcpSidecar(
    profile,
    mcpPort,
    extensionPort,
    logPrefix,
  )
  mcpPort = actualPorts.mcpPort
  extensionPort = actualPorts.extensionPort

  // Write actual port back to profile for UI consistency
  if (!profile.mcp) {
    profile.mcp = { transport: 'http', port: mcpPort, host: '127.0.0.1' }
  } else if (profile.mcp.port !== mcpPort) {
    profile.mcp.port = mcpPort
  }

  // Resolve proxy early so we can pass IP info to bootstrap health check
  const proxy = resolveProxyConfig(profile)
  let proxyIp = ''
  let proxyCountry = ''
  if (profile.proxyId) {
    const savedProxy = getProxy(profile.proxyId)
    proxyIp = savedProxy?.geoLocation?.ip || savedProxy?.host || ''
    proxyCountry = savedProxy?.geoLocation?.country || ''
  }

  const startupUrl = createZenBootstrapUrl(
    profileDir,
    mcpPort,
    extensionPort,
    profile.id,
    {
      targetUrl: profile.startupUrl || getDefaultPlatformUrl(profile.platform),
      profileName: profile.name,
      profileIp: proxyIp,
      profileCountry: proxyCountry,
      expectedTimezone: profile.fingerprint.timezone.name,
      expectedLanguage: profile.fingerprint.navigator.language,
    },
  )

  // Build Firefox launch arguments
  // -no-remote ensures each profile runs as an independent process;
  // without it Firefox reuses the first running instance and ignores CAMOU_CONFIG
  const args = [
    browserPath,
    '-profile',
    profileDir,
    '-no-remote',
    '-purgecaches',
  ]
  const userJsPath = join(profileDir, 'user.js')
  const userJsContent = buildZenUserJs(profile, proxy ?? null)
  writeFileSync(userJsPath, userJsContent, 'utf-8')

  // Startup URL
  args.push('-url', startupUrl)

  // Set environment variables
  const env = { ...process.env }
  env.TZ = profile.fingerprint.timezone.name

  // Pass fingerprint config via CAMOU_CONFIG env var
  if (camouConfigJson) {
    env.CAMOU_CONFIG = camouConfigJson
  }

  // Sandbox disabled both via user.js pref (security.sandbox.content.level=0)
  // and env var as fallback for the ContentParent null pointer crash fix
  env.MOZ_DISABLE_CONTENT_SANDBOX = '1'

  try {
    const executable = browserPath
    const browserProcess = spawn(executable, args.slice(1), {
      env,
      detached: true,
      stdio: 'ignore',
    }) as ChildProcess

    browserProcess.unref()
    runningProcesses.set(profile.id, browserProcess)
    updateProfileStatus(profile.id, 'running', { pid: browserProcess.pid })

    browserProcess.on('exit', (code: number | null) => {
      console.log(
        `${logPrefix} Process exited with code ${code} for profile ${profile.id}`,
      )
      runningProcesses.delete(profile.id)
      stopMcpSidecar(profile.id)
      stopGostForProfile(profile.id)
      updateProfileStatus(profile.id, 'idle')
      // Notify registered callback (e.g. for cookie sync on exit)
      if (browserExitCallback) {
        try {
          browserExitCallback(profile.id, code)
        } catch {}
      }
    })

    return {
      success: true,
      pid: browserProcess.pid,
    }
  } catch (err) {
    const error =
      err instanceof Error ? err.message : 'Failed to launch Zen Browser'
    updateProfileStatus(profile.id, 'error', { error })
    return { success: false, error }
  }
}

function createChromiumBootstrapUrl(
  userDataDir: string,
  opts: {
    profileId: string
    targetUrl?: string
    profileName: string
    profileIp: string
    profileCountry: string
    expectedTimezone: string
    expectedLanguage: string
  },
): string {
  const bootstrapPath = join(userDataDir, 'browseros-health-check.html')
  const html = buildHealthCheckHtml(opts.profileId)
  writeFileSync(bootstrapPath, html, 'utf-8')

  const bootstrapUrl = pathToFileURL(bootstrapPath)
  bootstrapUrl.searchParams.set('profileId', opts.profileId)
  bootstrapUrl.searchParams.set('profileName', opts.profileName)
  bootstrapUrl.searchParams.set('profileIp', opts.profileIp)
  bootstrapUrl.searchParams.set('profileCountry', opts.profileCountry)
  bootstrapUrl.searchParams.set('expectedTimezone', opts.expectedTimezone)
  bootstrapUrl.searchParams.set('expectedLanguage', opts.expectedLanguage)
  if (opts.targetUrl) {
    bootstrapUrl.searchParams.set('target', opts.targetUrl)
  }
  return bootstrapUrl.toString()
}

const PLATFORM_DEFAULT_URLS: Record<string, string> = {
  amazon: 'https://www.amazon.com/',
  ebay: 'https://www.ebay.com/',
  shopee: 'https://shopee.com/',
  lazada: 'https://www.lazada.com/',
  aliexpress: 'https://www.aliexpress.com/',
  wish: 'https://www.wish.com/',
  etsy: 'https://www.etsy.com/',
  walmart: 'https://www.walmart.com/',
  mercadolibre: 'https://www.mercadolibre.com/',
}

function getDefaultPlatformUrl(platform?: string): string | undefined {
  return platform ? PLATFORM_DEFAULT_URLS[platform] : undefined
}

interface BootstrapHealthCheckOptions {
  targetUrl?: string
  profileName: string
  profileIp: string
  profileCountry: string
  expectedTimezone: string
  expectedLanguage: string
}

function createZenBootstrapUrl(
  profileDir: string,
  httpPort: number,
  wsPort: number,
  profileId: string,
  healthCheck: BootstrapHealthCheckOptions,
): string {
  const bootstrapPath = join(profileDir, 'browseros-mcp-bootstrap.html')
  const redirectTarget = healthCheck.targetUrl || ''
  const html = buildHealthCheckHtml(profileId)
  writeFileSync(bootstrapPath, html, 'utf-8')

  const bootstrapUrl = pathToFileURL(bootstrapPath)
  bootstrapUrl.searchParams.set('browserosBootstrap', '1')
  bootstrapUrl.searchParams.set('httpPort', String(httpPort))
  bootstrapUrl.searchParams.set('wsPort', String(wsPort))
  bootstrapUrl.searchParams.set('profileId', profileId)
  bootstrapUrl.searchParams.set('profileName', healthCheck.profileName)
  bootstrapUrl.searchParams.set('profileIp', healthCheck.profileIp)
  bootstrapUrl.searchParams.set('profileCountry', healthCheck.profileCountry)
  bootstrapUrl.searchParams.set(
    'expectedTimezone',
    healthCheck.expectedTimezone,
  )
  bootstrapUrl.searchParams.set(
    'expectedLanguage',
    healthCheck.expectedLanguage,
  )
  if (redirectTarget) {
    bootstrapUrl.searchParams.set('target', redirectTarget)
  }
  return bootstrapUrl.toString()
}

function buildHealthCheckHtml(profileId: string): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>BrowserOS Health Check</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    :root { color-scheme: light; }
    body {
      min-height: 100vh;
      display: grid;
      place-items: center;
      background: #f5f5f0;
      color: #1a1a18;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    main {
      width: min(520px, calc(100vw - 32px));
      padding: 32px 36px;
      border: 1px solid #d4d1ca;
      border-radius: 12px;
      background: #ffffff;
      box-shadow: 0 4px 12px rgba(0,0,0,0.06);
    }
    .header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 1px solid #e0ddd8;
    }
    .status-dot {
      width: 10px; height: 10px;
      border-radius: 50%;
      background: #0f6f5c;
      animation: pulse 1.5s ease-in-out infinite;
      flex-shrink: 0;
    }
    .status-dot.pass { background: #16a34a; animation: none; }
    .status-dot.fail { background: #dc2626; animation: none; }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.35; }
    }
    h1 {
      font-size: 20px;
      font-weight: 700;
      color: #1a1a18;
      letter-spacing: -0.02em;
    }
    h1 span {
      color: #a3a29d;
      font-weight: 400;
      font-size: 15px;
      margin-left: 6px;
    }
    .checks { display: flex; flex-direction: column; gap: 0; }
    .check-row {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 12px 8px;
      border-bottom: 1px solid #e0ddd8;
      font-size: 14px;
      opacity: 0;
      transform: translateY(4px);
      transition: opacity 0.3s ease, transform 0.3s ease;
    }
    .check-row:last-child { border-bottom: none; }
    .check-row.visible { opacity: 1; transform: translateY(0); }
    .check-icon {
      width: 22px; height: 22px;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .check-icon.pending .dot {
      width: 7px; height: 7px; border-radius: 50%;
      background: #a3a29d;
    }
    .check-icon svg { width: 16px; height: 16px; }
    .check-icon.pass svg { color: #16a34a; }
    .check-icon.fail svg { color: #dc2626; }
    .check-label { flex: 1; color: #6b6b66; font-size: 14px; }
    .check-value {
      font-family: "SF Mono", "JetBrains Mono", Menlo, monospace;
      font-size: 13px;
      color: #1a1a18;
      text-align: right;
    }
    .check-value.fail { color: #dc2626; }
    .check-expected {
      font-size: 11px;
      color: #a3a29d;
      margin-top: 2px;
      text-align: right;
    }
    .summary {
      margin-top: 20px;
      padding-top: 16px;
      border-top: 1px solid #e0ddd8;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .summary-text { font-size: 14px; color: #6b6b66; }
    .summary-text.pass { color: #16a34a; }
    .summary-text.fail { color: #dc2626; }
    .btn {
      padding: 8px 20px;
      border: 1px solid #d4d1ca;
      border-radius: 8px;
      background: #fafaf7;
      color: #1a1a18;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: all 180ms cubic-bezier(0.16, 1, 0.3, 1);
      text-decoration: none;
      display: none;
    }
    .btn:hover { background: #0f6f5c; color: #f9f8f4; border-color: #0f6f5c; }
    .btn.visible { display: inline-block; }
    .countdown { font-size: 12px; color: #a3a29d; margin-top: 4px; }
  </style>
</head>
<body>
  <main>
    <div class="header">
      <div class="status-dot" id="mainDot"></div>
      <h1 id="title">检查中...</h1>
    </div>
    <div class="checks" id="checks"></div>
    <div class="summary" id="summary" style="display:none">
      <div>
        <div class="summary-text" id="summaryText"></div>
        <div class="countdown" id="countdown"></div>
      </div>
      <a class="btn" id="goBtn">开始浏览</a>
    </div>
  </main>
  <script>
    const P = new URLSearchParams(location.search);
    const profileName = P.get('profileName') || '${profileId}';
    const profileCountry = P.get('profileCountry') || '';
    const expectedIp = P.get('profileIp') || '';
    const expectedTz = P.get('expectedTimezone') || '';
    const expectedLang = P.get('expectedLanguage') || '';
    const target = P.get('target') || '';

    document.getElementById('title').innerHTML =
      profileName + (profileCountry ? ' <span>' + profileCountry + '</span>' : '');

    const checks = [
      { id: 'network', label: '网络连通' },
      { id: 'ip', label: 'IP 一致性' },
      { id: 'timezone', label: '时区匹配' },
      { id: 'language', label: '语言匹配' },
      { id: 'webrtc', label: 'WebRTC 泄漏' },
    ];

    const container = document.getElementById('checks');
    for (const c of checks) {
      const row = document.createElement('div');
      row.className = 'check-row';
      row.id = 'row-' + c.id;
      row.innerHTML =
        '<div class="check-icon pending" id="icon-' + c.id + '"><div class="dot"></div></div>' +
        '<div class="check-label">' + c.label + '</div>' +
        '<div><div class="check-value" id="val-' + c.id + '">--</div>' +
        '<div class="check-expected" id="exp-' + c.id + '"></div></div>';
      container.appendChild(row);
    }

    function setResult(id, pass, value, expected) {
      const icon = document.getElementById('icon-' + id);
      const val = document.getElementById('val-' + id);
      const exp = document.getElementById('exp-' + id);
      const row = document.getElementById('row-' + id);
      icon.className = 'check-icon ' + (pass ? 'pass' : 'fail');
      icon.innerHTML = pass
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
      val.textContent = value;
      if (!pass) val.className = 'check-value fail';
      if (expected && !pass) exp.textContent = '期望: ' + expected;
      row.className = 'check-row visible';
    }

    function showPending(id) {
      document.getElementById('row-' + id).className = 'check-row visible';
    }

    let allPass = true;
    let completed = 0;
    const total = checks.length;

    function checkDone() {
      completed++;
      if (completed < total) return;
      const dot = document.getElementById('mainDot');
      const summary = document.getElementById('summary');
      const summaryText = document.getElementById('summaryText');
      const goBtn = document.getElementById('goBtn');
      summary.style.display = 'flex';
      if (allPass) {
        dot.className = 'status-dot pass';
        summaryText.className = 'summary-text pass';
        summaryText.textContent = '所有检查通过';
        if (target) {
          goBtn.href = target;
          goBtn.className = 'btn visible';
          let sec = 3;
          const cd = document.getElementById('countdown');
          cd.textContent = sec + ' 秒后自动跳转...';
          const timer = setInterval(() => {
            sec--;
            if (sec <= 0) { clearInterval(timer); location.replace(target); }
            else cd.textContent = sec + ' 秒后自动跳转...';
          }, 1000);
          goBtn.addEventListener('click', (e) => { e.preventDefault(); clearInterval(timer); location.replace(target); });
        }
      } else {
        dot.className = 'status-dot fail';
        summaryText.className = 'summary-text fail';
        summaryText.textContent = '部分检查未通过';
        if (target) {
          goBtn.href = target;
          goBtn.textContent = '继续浏览';
          goBtn.className = 'btn visible';
          goBtn.addEventListener('click', (e) => { e.preventDefault(); location.replace(target); });
        }
      }
    }

    async function runChecks() {
      // Stagger reveal
      const delay = (ms) => new Promise(r => setTimeout(r, ms));

      // 1. Network + IP
      showPending('network');
      showPending('ip');
      let actualIp = '';
      try {
        const ctrl = new AbortController();
        const timeout = setTimeout(() => ctrl.abort(), 8000);
        const res = await fetch('https://api.ipify.org?format=json', { signal: ctrl.signal });
        clearTimeout(timeout);
        const data = await res.json();
        actualIp = data.ip || '';
        setResult('network', true, '已连接 (' + actualIp + ')', '');
      } catch (e) {
        allPass = false;
        setResult('network', false, e.name === 'AbortError' ? '超时' : '连接失败', '');
        setResult('ip', false, '无法检测', expectedIp);
        checkDone(); checkDone();
        // continue other checks
        await delay(150);
        runLocalChecks();
        return;
      }
      checkDone();
      await delay(150);

      // 2. IP match
      if (expectedIp) {
        const match = actualIp === expectedIp;
        if (!match) allPass = false;
        setResult('ip', match, actualIp, expectedIp);
      } else {
        setResult('ip', true, actualIp + ' (未配置期望 IP)', '');
      }
      checkDone();
      await delay(150);

      runLocalChecks();
    }

    async function runLocalChecks() {
      const delay = (ms) => new Promise(r => setTimeout(r, ms));

      // 3. Timezone
      showPending('timezone');
      const actualTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (expectedTz) {
        const match = actualTz === expectedTz;
        if (!match) allPass = false;
        setResult('timezone', match, actualTz, expectedTz);
      } else {
        setResult('timezone', true, actualTz, '');
      }
      checkDone();
      await delay(150);

      // 4. Language
      showPending('language');
      const actualLang = navigator.language;
      if (expectedLang) {
        const match = actualLang === expectedLang;
        if (!match) allPass = false;
        setResult('language', match, actualLang, expectedLang);
      } else {
        setResult('language', true, actualLang, '');
      }
      checkDone();
      await delay(150);

      // 5. WebRTC leak detection
      showPending('webrtc');
      try {
        const leaked = await detectWebRTCLeak();
        if (leaked) {
          allPass = false;
          setResult('webrtc', false, '泄漏: ' + leaked, '无泄漏');
        } else {
          setResult('webrtc', true, '无泄漏', '');
        }
      } catch {
        setResult('webrtc', true, '已屏蔽 (安全)', '');
      }
      checkDone();
    }

    function detectWebRTCLeak() {
      return new Promise((resolve) => {
        const timeout = setTimeout(() => resolve(null), 4000);
        try {
          const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
          const candidates = [];
          pc.onicecandidate = (e) => {
            if (!e.candidate) {
              clearTimeout(timeout);
              pc.close();
              // Check if any candidate contains a non-private real IP
              const localIpPattern = /^(10\\.|172\\.(1[6-9]|2[0-9]|3[01])\\.|192\\.168\\.|127\\.|0\\.0\\.0\\.0|::1|fd|fe80)/;
              const leakedIp = candidates.find(ip => !localIpPattern.test(ip));
              resolve(leakedIp || null);
              return;
            }
            const match = e.candidate.candidate.match(/([0-9]{1,3}(\\.[0-9]{1,3}){3}|[a-f0-9]{1,4}(:[a-f0-9]{1,4}){7})/);
            if (match) candidates.push(match[1]);
          };
          pc.createDataChannel('');
          pc.createOffer().then(o => pc.setLocalDescription(o));
        } catch { clearTimeout(timeout); resolve(null); }
      });
    }

    // Start after a brief delay for extension bootstrap
    setTimeout(runChecks, 800);
  </script>
</body>
</html>
`
}

/**
 * Install the Controller Extension into a Zen profile's extensions directory.
 * Firefox auto-loads .xpi files from profile/extensions/ when the filename
 * matches the extension ID.
 */
function installZenControllerExtension(
  profileDir: string,
  logPrefix: string,
): void {
  const extensionId = 'browseros-controller@browseros.io'
  const extensionsDir = join(profileDir, 'extensions')
  if (!existsSync(extensionsDir)) {
    mkdirSync(extensionsDir, { recursive: true })
  }

  const targetXpi = join(extensionsDir, `${extensionId}.xpi`)

  // Locate the source XPI — try monorepo dev path first
  const monorepoRoot = resolveMonorepoRoot()
  const devXpiPath = join(
    monorepoRoot,
    'packages',
    'zen-browser',
    'extensions',
    'controller-ext',
    'controller.xpi',
  )

  // TODO: add production path (Craft Agent resources) when packaging

  if (existsSync(devXpiPath)) {
    try {
      copyFileSync(devXpiPath, targetXpi)
      console.log(`${logPrefix} Controller extension installed: ${targetXpi}`)
    } catch (err) {
      console.warn(
        `${logPrefix} Failed to install controller extension: ${err}`,
      )
    }
  } else {
    console.warn(
      `${logPrefix} Controller extension XPI not found at ${devXpiPath}`,
    )
  }
}

/**
 * Install an .xpi extension into a Zen/Firefox profile's extensions directory.
 * Firefox auto-loads .xpi files from profile/extensions/{extension-id}.xpi
 */
function installZenExtension(
  profileDir: string,
  xpiSourcePath: string,
  extensionId: string,
  logPrefix: string,
): void {
  const extensionsDir = join(profileDir, 'extensions')
  if (!existsSync(extensionsDir)) {
    mkdirSync(extensionsDir, { recursive: true })
  }

  const targetXpi = join(extensionsDir, `${extensionId}.xpi`)
  if (existsSync(xpiSourcePath)) {
    try {
      copyFileSync(xpiSourcePath, targetXpi)
      console.log(
        `${logPrefix} Extension ${extensionId} installed: ${targetXpi}`,
      )
    } catch (err) {
      console.warn(
        `${logPrefix} Failed to install extension ${extensionId}: ${err}`,
      )
    }
  } else {
    console.warn(`${logPrefix} Extension XPI not found at ${xpiSourcePath}`)
  }
}

async function getHealthProfileId(
  host: string,
  port: number,
): Promise<string | null> {
  try {
    const res = await fetch(`http://${host}:${port}/health`, {
      signal: AbortSignal.timeout(2000),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { profileId?: string }
    return data.profileId ?? null
  } catch {
    return null
  }
}

async function findAvailablePort(
  startPort: number,
  min: number,
  max: number,
): Promise<number> {
  for (let port = startPort; port <= max; port++) {
    const available = await new Promise<boolean>((resolve) => {
      import('node:net').then(({ createServer }) => {
        const server = createServer()
        server.once('error', () => resolve(false))
        server.listen({ port, host: '127.0.0.1' }, () => {
          server.close(() => resolve(true))
        })
      })
    })
    if (available) return port
  }
  // Wrap around and try ports before startPort
  for (let port = min; port < startPort; port++) {
    const available = await new Promise<boolean>((resolve) => {
      import('node:net').then(({ createServer }) => {
        const server = createServer()
        server.once('error', () => resolve(false))
        server.listen({ port, host: '127.0.0.1' }, () => {
          server.close(() => resolve(true))
        })
      })
    })
    if (available) return port
  }
  return startPort // fallback
}

/**
 * Start an MCP Server sidecar for a Zen Browser profile.
 * The sidecar connects to the Controller Extension via WebSocket and
 * exposes an HTTP MCP endpoint for Claude Code.
 */
async function ensureZenMcpSidecar(
  profile: BrowserProfileConfig,
  mcpPort: number,
  extensionPort: number,
  logPrefix: string,
): Promise<{ mcpPort: number; extensionPort: number }> {
  const host = '127.0.0.1'

  // Check if MCP is already available (e.g. from a previous launch)
  if (await waitForMcpHttpAvailable(host, mcpPort, 1000)) {
    const owner = await getHealthProfileId(host, mcpPort)
    if (owner === profile.id) {
      console.log(
        `${logPrefix} MCP server already running on ${host}:${mcpPort}`,
      )
      return { mcpPort, extensionPort }
    }
    // Port occupied by another profile's sidecar, find available ports
    console.log(
      `${logPrefix} Port ${mcpPort} occupied by profile ${owner}, finding alternative`,
    )
    mcpPort = await findAvailablePort(mcpPort + 1, 9100, 9199)
    extensionPort = await findAvailablePort(extensionPort + 1, 9400, 9499)
    console.log(
      `${logPrefix} Reassigned to MCP=${mcpPort}, WS=${extensionPort}`,
    )
  }

  // Kill existing sidecar if it's not responding
  const existing = mcpSidecarProcesses.get(profile.id)
  if (existing && !existing.killed) {
    if (await waitForMcpHttpAvailable(host, mcpPort, 2000)) {
      const owner = await getHealthProfileId(host, mcpPort)
      if (owner === profile.id) {
        return { mcpPort, extensionPort }
      }
    }
    stopMcpSidecar(profile.id)
  }

  // Write server_config.json for the sidecar
  const browserOsDir = join(profile.userDataDir, '.browseros')
  if (!existsSync(browserOsDir)) {
    mkdirSync(browserOsDir, { recursive: true })
  }

  const serverConfig = {
    directories: {
      execution: browserOsDir,
      resources: browserOsDir,
    },
    flags: {
      allow_remote_in_mcp: false,
    },
    instance: {
      profile_id: profile.id,
      browseros_version: '',
      chromium_version: '',
      install_id: '',
    },
    ports: {
      extension: extensionPort,
      http_mcp: mcpPort,
    },
  }
  const serverConfigPath = join(browserOsDir, 'server_config.json')
  writeFileSync(serverConfigPath, JSON.stringify(serverConfig))

  // Launch MCP server from source using bun
  const monorepoRoot = resolveMonorepoRoot()
  const serverEntry = join(monorepoRoot, 'apps', 'server', 'src', 'index.ts')
  if (!existsSync(serverEntry)) {
    console.warn(`${logPrefix} MCP server source not found at ${serverEntry}`)
    return { mcpPort, extensionPort }
  }

  try {
    const sidecar = spawn(
      'bun',
      ['run', serverEntry, '--config', serverConfigPath],
      {
        env: { ...process.env },
        detached: true,
        stdio: 'ignore',
      },
    )
    sidecar.unref()
    mcpSidecarProcesses.set(profile.id, sidecar)
    sidecar.on('exit', () => {
      mcpSidecarProcesses.delete(profile.id)
    })

    console.log(
      `${logPrefix} MCP sidecar starting (HTTP=${mcpPort}, WS=${extensionPort})`,
    )
  } catch (err) {
    console.warn(`${logPrefix} Failed to launch MCP sidecar: ${err}`)
    return { mcpPort, extensionPort }
  }

  if (await waitForMcpHttpAvailable(host, mcpPort, 12000)) {
    console.log(`${logPrefix} MCP sidecar ready on http://${host}:${mcpPort}`)
  } else {
    console.warn(
      `${logPrefix} MCP sidecar started but HTTP endpoint unavailable on ${host}:${mcpPort}`,
    )
  }

  return { mcpPort, extensionPort }
}

function buildZenUserJs(
  profile: BrowserProfileConfig,
  proxy: ProxyConfig | null,
): string {
  const lines: string[] = [
    '// Auto-generated by Craft Agents for Zen Browser fingerprint profile',

    // Suppress first-run / welcome pages
    'user_pref("browser.startup.homepage_override.mstone", "ignore");',
    'user_pref("startup.homepage_welcome_url", "");',
    'user_pref("startup.homepage_welcome_url.additional", "");',
    'user_pref("browser.startup.firstrunSkipsHomepage", true);',
    'user_pref("browser.shell.checkDefaultBrowser", false);',
    'user_pref("browser.shell.skipDefaultBrowserCheckOnFirstRun", true);',

    // Prevent session restore from opening previous windows (causes double window)
    'user_pref("browser.startup.page", 0);',
    'user_pref("browser.sessionstore.resume_from_crash", false);',
    'user_pref("browser.sessionstore.max_resumed_crashes", 0);',
    // Never enter safe mode automatically (safe mode disables extensions including controller)
    'user_pref("toolkit.startup.max_resumed_crashes", -1);',

    // Suppress data reporting / telemetry warnings
    'user_pref("datareporting.policy.dataSubmissionEnabled", false);',
    'user_pref("datareporting.policy.dataSubmissionPolicyBypassNotification", true);',
    'user_pref("toolkit.telemetry.reportingpolicy.firstRun", false);',
    'user_pref("toolkit.telemetry.enabled", false);',

    // Suppress about:config warnings
    'user_pref("browser.aboutConfig.showWarning", false);',

    // Disable sandbox warning (set level to 0 instead of env var)
    'user_pref("security.sandbox.content.level", 0);',

    // Allow unsigned extensions (controller extension is not signed)
    'user_pref("xpinstall.signatures.required", false);',

    // Disable letterboxing (RFP rounds viewport, causing blank margins on resize)
    'user_pref("privacy.resistFingerprinting.letterboxing", false);',

    // Zen UI layout: Sidebar and Top Toolbar (address bar on top)
    'user_pref("zen.view.use-single-toolbar", false);',
    'user_pref("zen.urlbar.behavior", "normal");',

    // Suppress update / crash report notifications
    'user_pref("app.update.enabled", false);',
    'user_pref("app.update.auto", false);',
    'user_pref("browser.crashReports.unsubmittedCheck.autoSubmit2", false);',
    'user_pref("browser.crashReports.unsubmittedCheck.enabled", false);',

    // Disable "What's New" and recommendation badges
    'user_pref("browser.messaging-system.whatsNewPanel.enabled", false);',
    'user_pref("extensions.getAddons.showPane", false);',
    'user_pref("browser.newtabpage.activity-stream.asrouter.userprefs.cfr.addons", false);',
    'user_pref("browser.newtabpage.activity-stream.asrouter.userprefs.cfr.features", false);',

    // Suppress "unsafe" warnings in developer builds
    'user_pref("browser.warnOnQuitShortcut", false);',
    'user_pref("browser.tabs.warnOnClose", false);',
    'user_pref("browser.tabs.warnOnCloseOtherTabs", false);',

    // Disable Normandy / Shield studies
    'user_pref("app.normandy.enabled", false);',
    'user_pref("app.shield.optoutstudies.enabled", false);',

    // Disable captive portal detection (can cause warnings behind proxies)
    'user_pref("network.captive-portal-service.enabled", false);',
    'user_pref("network.connectivity-service.enabled", false);',
  ]

  // Proxy configuration
  if (proxy) {
    lines.push(
      '',
      '// Proxy configuration',
      'user_pref("network.proxy.type", 1);',
    )

    if (proxy.type === 'socks5') {
      lines.push(
        `user_pref("network.proxy.socks", "${proxy.host}");`,
        `user_pref("network.proxy.socks_port", ${proxy.port});`,
        `user_pref("network.proxy.socks_version", 5);`,
        `user_pref("network.proxy.socks_remote_dns", true);`,
      )
    } else {
      lines.push(
        `user_pref("network.proxy.http", "${proxy.host}");`,
        `user_pref("network.proxy.http_port", ${proxy.port});`,
        `user_pref("network.proxy.ssl", "${proxy.host}");`,
        `user_pref("network.proxy.ssl_port", ${proxy.port});`,
      )
    }

    lines.push(
      'user_pref("network.proxy.no_proxies_on", "127.0.0.1,localhost,[::1]");',
    )
  }

  // Navigator overrides (main window context — MaskConfig only covers WorkerNavigator)
  const nav = profile.fingerprint.navigator
  lines.push(
    '',
    '// Navigator overrides for main window context',
    `user_pref("general.useragent.override", "${nav.userAgent}");`,
    `user_pref("general.platform.override", "${nav.platform}");`,
    `user_pref("general.appversion.override", "${nav.appVersion}");`,
  )

  // oscpu override — must match platform (Win32 → Windows NT 10.0; Win64; x64)
  if (nav.platform === 'Win32') {
    lines.push(
      `user_pref("general.oscpu.override", "Windows NT 10.0; Win64; x64");`,
    )
  } else if (nav.platform === 'MacIntel') {
    lines.push(`user_pref("general.oscpu.override", "Intel Mac OS X 10.15");`)
  } else if (nav.platform.startsWith('Linux')) {
    lines.push(`user_pref("general.oscpu.override", "Linux x86_64");`)
  }

  // WebGL: hide real GPU renderer behind "Mozilla" (standard Firefox behavior)
  const webgl = profile.fingerprint.webgl
  lines.push(
    '',
    '// WebGL fingerprint overrides',
    'user_pref("webgl.enable-renderer-query", false);',
    `user_pref("webgl.override-unmasked-renderer", "${webgl.unmaskedRenderer}");`,
    `user_pref("webgl.override-unmasked-vendor", "${webgl.unmaskedVendor}");`,
  )

  // Font overrides — use Windows-native font families when spoofing Windows
  if (nav.platform === 'Win32') {
    lines.push(
      '',
      '// Font family overrides for Windows platform spoofing',
      'user_pref("font.name-list.serif.x-western", "Times New Roman");',
      'user_pref("font.name-list.sans-serif.x-western", "Arial");',
      'user_pref("font.name-list.monospace.x-western", "Consolas");',
      'user_pref("layout.css.font-visibility.standard", 1);',
      'user_pref("layout.css.font-visibility.trackingprotection", 1);',
    )
  }

  // Language / locale preferences matching fingerprint
  const lang = nav.language
  if (lang) {
    lines.push(
      '',
      '// Language preferences',
      `user_pref("intl.accept_languages", "${profile.fingerprint.navigator.languages.join(',')}");`,
      `user_pref("general.useragent.locale", "${lang}");`,
    )
  }

  // Font spacing seed for per-profile Canvas/font differentiation.
  // browser-init.js reads this pref and calls window.setFontSpacingSeed(seed)
  // to override the fixed fallback constant in FontSpacingSeedManager.
  const fontSpacingSeed = profile.fingerprint.canvas.noiseSeed || Date.now()
  lines.push(
    '',
    '// Font spacing seed (anti-font-fingerprinting)',
    `user_pref("browseros.fontSpacing.seed", ${fontSpacingSeed});`,
  )

  // Auto-approve extension installation (suppress first-run permission prompt)
  lines.push(
    '',
    '// Auto-approve controller extension',
    'user_pref("extensions.autoDisableScopes", 0);',
    'user_pref("extensions.enabledScopes", 15);',
  )

  // Pin controller extension icon to the navbar (Zen toolbar)
  // Widget ID format: {extensionId-normalized}-browser-action
  lines.push(
    '',
    '// Pin MCP controller extension to toolbar',
    `user_pref("browser.uiCustomization.state", '${JSON.stringify({
      placements: {
        'nav-bar': [
          'back-button',
          'forward-button',
          'stop-reload-button',
          'urlbar-container',
          'browseros-controller_browseros_io-browser-action',
        ],
        'toolbar-menubar': ['menubar-items'],
        TabsToolbar: ['tabbrowser-tabs', 'new-tab-button', 'alltabs-button'],
        'widget-overflow-fixed-list': [],
        PersonalToolbar: ['personal-bookmarks'],
      },
      seen: ['browseros-controller_browseros_io-browser-action'],
      dirtyAreaCache: ['nav-bar'],
      currentVersion: 20,
      newElementCount: 0,
    })}');`,
  )

  return `${lines.join('\n')}\n`
}

/**
 * Launch options for browser
 */
export interface LaunchBrowserOptions {
  /** Custom browser configuration */
  browserConfig?: BrowserConfig
  /** Profile number for dock icon display (1, 2, 3...) */
  profileNumber?: number
}

/**
 * Inject stored cookies into a browser after launch via CDP.
 * Retries a few times since the browser may not be ready immediately.
 */
async function injectStoredCookies(
  profileId: string,
  cdpPort: number,
  logPrefix: string,
): Promise<void> {
  const cookies = loadCookiesFromProfile(profileId)
  if (cookies.length === 0) return

  // Wait for CDP to be ready (browser needs time to start)
  for (let attempt = 0; attempt < 5; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 2000 + attempt * 1000))

    try {
      const result = await injectCookiesViaCDP(cdpPort, cookies)
      console.log(
        `${logPrefix} Injected ${result.success} cookies (${result.failed} failed) for profile ${profileId}`,
      )
      return
    } catch {
      if (attempt < 4) continue
      console.warn(
        `${logPrefix} Failed to inject cookies for profile ${profileId} after 5 attempts`,
      )
    }
  }
}

/**
 * Launch a browser instance for a profile
 *
 * @param profile - Browser profile configuration
 * @param options - Optional launch options including custom browser config
 */
export async function launchBrowser(
  profile: BrowserProfileConfig,
  options?: LaunchBrowserOptions,
): Promise<LaunchResult> {
  // Check if already running
  if (runningProcesses.has(profile.id)) {
    const existingProcess = runningProcesses.get(profile.id)
    if (existingProcess && !existingProcess.killed) {
      return {
        success: true,
        pid: existingProcess.pid,
      }
    }
    // Clean up dead process
    runningProcesses.delete(profile.id)
  }

  // Ensure language prefs match fingerprint (Accept-Language, selected languages)
  ensureLanguagePreferences(profile)

  // If profile specifies Zen browser engine, use the Zen-specific launch path
  if (profile.browserEngine === 'zen-browser') {
    return launchZenBrowser(profile, options)
  }

  // Find browser executable (with custom config support)
  const browserPath = findBrowserExecutable(options?.browserConfig)
  if (!browserPath) {
    const customPath = options?.browserConfig?.customBrowserPath
    const error = customPath
      ? `Custom browser executable not found: ${customPath}`
      : 'No browser executable found. Please install Nova Seller, BrowserOS, or Chrome.'
    updateProfileStatus(profile.id, 'error', { error })
    return { success: false, error }
  }

  // For custom fingerprint browsers (Nova Seller/BrowserOS), setup and load extensions
  // This ensures bundled extensions (Agent, Controller, uBlock) are available
  let extensionPaths: string[] = []
  const usingCustomBrowser = isCustomFingerprintBrowser(browserPath)
  const usingNovaSeller = isNovaSeller(browserPath)
  const logPrefix = usingNovaSeller ? '[Nova Seller]' : '[Launcher]'

  if (usingCustomBrowser) {
    extensionPaths = setupCustomBrowserExtensions(
      profile.userDataDir,
      browserPath,
    )
    cleanupBlockedExtensions(profile.userDataDir, logPrefix)
    const runtimeConfig = ensureBrowserOSServerRuntimeConfig(
      profile,
      browserPath,
    )

    // Sync profile.mcp.port with actual allocated port to prevent mismatch
    if (runtimeConfig) {
      if (!profile.mcp) {
        profile.mcp = {
          transport: 'http',
          port: runtimeConfig.mcpPort,
          host: '127.0.0.1',
        }
      } else if (profile.mcp.port !== runtimeConfig.mcpPort) {
        profile.mcp.port = runtimeConfig.mcpPort
      }
    }

    // Auto-whitelist allocated MCP/CDP/Extension ports for port scan protection.
    // Without this, browser-internal JS cannot reach localhost MCP endpoints
    // when portScanProtection is enabled.
    if (runtimeConfig && profile.fingerprint.portScanProtection) {
      const allocatedPorts = [
        runtimeConfig.mcpPort,
        runtimeConfig.cdpPort,
        runtimeConfig.serverPort,
        runtimeConfig.extensionPort,
      ]
      const existing = profile.fingerprint.portScanWhitelist || []
      profile.fingerprint.portScanWhitelist = [
        ...new Set([...existing, ...allocatedPorts]),
      ]
    }

    // Write kernel-level fingerprint configuration (with caching for performance)
    // This provides more robust fingerprint spoofing than JS injection
    // Also includes profile name for address bar badge display
    try {
      const launchFingerprint = normalizeFingerprintForLaunch(profile)
      const savedProxy = profile.proxyId ? getProxy(profile.proxyId) : undefined
      const writeResult = writeBrowserOSConfigCached(
        profile.id,
        launchFingerprint,
        {
          profileName: profile.name,
          platform: profile.platform,
          proxyCountry: savedProxy?.geoLocation?.country || '',
          proxyIp: savedProxy?.geoLocation?.ip || savedProxy?.host || '',
          profileNumber: options?.profileNumber,
        },
      )
      if (writeResult.written) {
        console.log(
          `${logPrefix} Kernel config written to: ${writeResult.path}`,
        )
      } else {
        console.log(
          `${logPrefix} Kernel config unchanged (cached): ${writeResult.path}`,
        )
      }
    } catch (err) {
      console.warn(`${logPrefix} Failed to write kernel config: ${err}`)
      // Continue anyway - kernel config is preferred but not fatal if it fails
    }
  }

  // Fingerprint injection extension: loaded for ALL browser types.
  // Even BrowserOS needs the extension for JS-level defenses that the C++ kernel
  // cannot provide: WebGL timing attack defense, Web Share API stubs, Intl locale
  // overrides, and mobile API stubs for CreepJS.
  {
    const profileDir = getProfilePath(profile.id)
    if (hasExtension(profileDir)) {
      const fingerprintExtPath = getExtensionPath(profileDir)
      extensionPaths.push(fingerprintExtPath)
      console.log(
        `${logPrefix} Loading fingerprint extension from: ${fingerprintExtPath}`,
      )
    }
  }

  // Guard against Chromium version downgrades that crash on incompatible databases.
  // Also always clean WebApp databases for custom browsers because the protobuf
  // schema version can differ even within the same major Chromium version (e.g.,
  // web_app_database.cc version 6 vs 3), causing fatal CHECK failures on startup.
  if (usingCustomBrowser) {
    const browserMajor = getBrowserMajorVersion(browserPath)
    const dataMajor = getUserDataMajorVersion(profile.userDataDir)
    if (
      browserMajor !== null &&
      dataMajor !== null &&
      browserMajor !== dataMajor
    ) {
      cleanIncompatibleDatabases(
        profile.userDataDir,
        browserMajor,
        dataMajor,
        logPrefix,
      )
    } else {
      // Even with same major version, WebApp schema may differ between builds
      cleanWebAppDatabases(profile.userDataDir, logPrefix)
    }
  }

  // Build launch arguments
  // Read the CDP port from server_config.json so browseros_server can connect
  let cdpPort: number | undefined
  if (usingCustomBrowser) {
    const serverConfigPath = join(
      profile.userDataDir,
      '.browseros',
      'server_config.json',
    )
    try {
      const serverConfig = JSON.parse(readFileSync(serverConfigPath, 'utf-8'))
      cdpPort = serverConfig?.ports?.cdp
    } catch {}
  }

  // Start gost acceleration if enabled
  let effectiveProxyUrl: string | undefined
  const proxy = resolveProxyConfig(profile)
  if (profile.accelerated && proxy) {
    const accelerator = getDefaultAccelerator()
    if (accelerator && isGostAvailable()) {
      try {
        // Allocate a gost port in the 9500-9599 range
        const usedPorts = loadRegisteredPorts(profile.id)
        const profileHash = profile.id
          .split('')
          .reduce((a, c) => a + c.charCodeAt(0), 0)
        let gostPort = 9500 + (profileHash % 100)
        while (usedPorts.has(gostPort) && gostPort < 9600) gostPort++
        if (gostPort >= 9600) gostPort = 9500 // wrap around

        await startGostForProfile(profile.id, {
          accelerator,
          proxy,
          localPort: gostPort,
        })
        effectiveProxyUrl = `socks5://127.0.0.1:${gostPort}`
        console.log(
          `[Launcher] gost acceleration started on port ${gostPort} for profile ${profile.name}`,
        )
      } catch (err) {
        console.warn(
          `[Launcher] gost acceleration failed, falling back to direct proxy: ${err}`,
        )
        // Fallback: direct proxy without acceleration
      }
    }
  }

  const args = buildLaunchArgs(profile, browserPath, extensionPaths, {
    cdpPort,
    effectiveProxyUrl,
  })

  // Set environment variables
  const env = { ...process.env }

  // Set timezone
  env.TZ = profile.fingerprint.timezone.name

  // For custom fingerprint browsers, set the kernel-level fingerprint config path
  if (usingCustomBrowser) {
    const configPath = getBrowserOSConfigPath(profile.id)
    // Support both Nova Seller and BrowserOS env vars
    if (usingNovaSeller) {
      env[NOVA_SELLER_ENV.fingerprintConfig] = configPath
    }
    env.BROWSEROS_FINGERPRINT_CONFIG = configPath
  }

  // Set TLS profile for JA3/JA4 consistency if provided
  if (usingCustomBrowser && profile.fingerprint.tlsProfile) {
    if (usingNovaSeller) {
      env[NOVA_SELLER_ENV.tlsProfile] = profile.fingerprint.tlsProfile
    }
    env.BROWSEROS_TLS_PROFILE = profile.fingerprint.tlsProfile
  }

  try {
    // Validate args array
    const executable = args[0]
    if (!executable) {
      const error = 'No browser executable in arguments'
      updateProfileStatus(profile.id, 'error', { error })
      return { success: false, error }
    }

    // Launch browser process
    const browserProcess = spawn(executable, args.slice(1), {
      env,
      detached: true,
      stdio: 'ignore',
    })

    // Don't wait for the process
    browserProcess.unref()

    // Track the process
    runningProcesses.set(profile.id, browserProcess)

    // Update port registry with actual PID
    if (browserProcess.pid) {
      const serverConfigPath = join(
        profile.userDataDir,
        '.browseros',
        'server_config.json',
      )
      try {
        const sc = JSON.parse(readFileSync(serverConfigPath, 'utf-8'))
        const p = sc?.ports
        if (p) {
          registerProfilePorts(profile.id, {
            proxy: p.proxy ?? p.http_mcp ?? 0,
            cdp: p.cdp ?? 0,
            server: p.server ?? 0,
            extension: p.extension ?? 0,
            pid: browserProcess.pid,
            updatedAt: Date.now(),
          })
        }
      } catch {
        // Port registry already has pid=0 entry from ensureBrowserOSServerRuntimeConfig
      }
    }

    // Update profile status
    updateProfileStatus(profile.id, 'running', { pid: browserProcess.pid })

    // Handle process exit
    browserProcess.on('exit', (code: number | null) => {
      runningProcesses.delete(profile.id)
      stopMcpSidecar(profile.id)
      stopGostForProfile(profile.id)
      unregisterProfilePorts(profile.id)
      if (code !== 0 && code !== null) {
        updateProfileStatus(profile.id, 'error', {
          error: `Browser exited with code ${code}`,
        })
      } else {
        updateProfileStatus(profile.id, 'idle')
      }
      // Notify registered callback (e.g. for cookie sync on exit)
      if (browserExitCallback) {
        try {
          browserExitCallback(profile.id, code)
        } catch {}
      }
    })

    browserProcess.on('error', (err: Error) => {
      runningProcesses.delete(profile.id)
      stopMcpSidecar(profile.id)
      stopGostForProfile(profile.id)
      unregisterProfilePorts(profile.id)
      updateProfileStatus(profile.id, 'error', { error: err.message })
    })

    if (usingCustomBrowser) {
      void ensureMcpSidecarForProfile(profile, browserPath, logPrefix)
    }

    // Inject stored cookies via CDP after browser starts (fire-and-forget)
    if (cdpPort) {
      void injectStoredCookies(profile.id, cdpPort, logPrefix)
    }

    return {
      success: true,
      pid: browserProcess.pid,
    }
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error'
    updateProfileStatus(profile.id, 'error', { error })
    return { success: false, error }
  }
}

/**
 * Stop a running browser instance
 */
export function stopBrowser(profileId: string): boolean {
  const browserProcess = runningProcesses.get(profileId)
  if (!browserProcess) {
    stopMcpSidecar(profileId)
    stopGostForProfile(profileId)
    unregisterProfilePorts(profileId)
    return false
  }

  try {
    // Send SIGTERM to gracefully stop the process
    browserProcess.kill('SIGTERM')

    // Force kill after 5 seconds if still running
    setTimeout(() => {
      if (!browserProcess.killed) {
        browserProcess.kill('SIGKILL')
      }
    }, 5000)

    runningProcesses.delete(profileId)
    stopMcpSidecar(profileId)
    stopGostForProfile(profileId)
    unregisterProfilePorts(profileId)
    updateProfileStatus(profileId, 'idle')
    return true
  } catch {
    runningProcesses.delete(profileId)
    stopMcpSidecar(profileId)
    stopGostForProfile(profileId)
    unregisterProfilePorts(profileId)
    updateProfileStatus(profileId, 'idle')
    return true
  }
}

/**
 * Check if a browser is running for a profile
 */
export function isBrowserRunning(profileId: string): boolean {
  const browserProcess = runningProcesses.get(profileId)
  if (!browserProcess) return false

  // Check if process is still alive
  try {
    process.kill(browserProcess.pid ?? 0, 0)
    return true
  } catch {
    // Process is dead, clean up
    runningProcesses.delete(profileId)
    stopMcpSidecar(profileId)
    stopGostForProfile(profileId)
    unregisterProfilePorts(profileId)
    updateProfileStatus(profileId, 'idle')
    return false
  }
}

/**
 * Get the MCP port allocated for a profile.
 * Returns the deterministic port based on profile ID hash, or the
 * explicitly configured port if one exists.
 */
export function getProfileMcpPort(profileId: string): number {
  const profileRoot = getProfilePath(profileId)
  const serverConfig = readJsonObject(
    join(profileRoot, 'user-data', '.browseros', 'server_config.json'),
  )
  const serverConfigPorts =
    serverConfig?.ports && typeof serverConfig.ports === 'object'
      ? (serverConfig.ports as Record<string, unknown>)
      : null

  if (typeof serverConfigPorts?.proxy === 'number') {
    return serverConfigPorts.proxy
  }
  if (typeof serverConfigPorts?.http_mcp === 'number') {
    return serverConfigPorts.http_mcp
  }

  const localState = readJsonObject(
    join(profileRoot, 'user-data', 'Local State'),
  )
  const browseros =
    localState?.browseros && typeof localState.browseros === 'object'
      ? (localState.browseros as Record<string, unknown>)
      : null
  const server =
    browseros?.server && typeof browseros.server === 'object'
      ? (browseros.server as Record<string, unknown>)
      : null

  if (typeof server?.proxy_port === 'number') {
    return server.proxy_port
  }
  if (typeof server?.server_port === 'number') {
    return server.server_port
  }
  if (typeof server?.mcp_port === 'number') {
    return server.mcp_port
  }

  return stablePortFromProfileId(profileId, 9100, 9199)
}

/**
 * Get the CDP port allocated for a profile.
 * Reads from server_config.json or Local State.
 */
export function getProfileCdpPort(profileId: string): number | null {
  const profileRoot = getProfilePath(profileId)
  const serverConfig = readJsonObject(
    join(profileRoot, 'user-data', '.browseros', 'server_config.json'),
  )
  const serverConfigPorts =
    serverConfig?.ports && typeof serverConfig.ports === 'object'
      ? (serverConfig.ports as Record<string, unknown>)
      : null

  if (typeof serverConfigPorts?.cdp === 'number') {
    return serverConfigPorts.cdp
  }

  const localState = readJsonObject(
    join(profileRoot, 'user-data', 'Local State'),
  )
  const browseros =
    localState?.browseros && typeof localState.browseros === 'object'
      ? (localState.browseros as Record<string, unknown>)
      : null
  const server =
    browseros?.server && typeof browseros.server === 'object'
      ? (browseros.server as Record<string, unknown>)
      : null

  if (typeof server?.cdp_port === 'number') {
    return server.cdp_port
  }

  return null
}

/**
 * Callback invoked when a browser process exits.
 * Receives profileId and exit code.
 */
type BrowserExitCallback = (profileId: string, code: number | null) => void

let browserExitCallback: BrowserExitCallback | null = null

/**
 * Register a callback to be invoked when any browser process exits.
 * Only one callback can be registered at a time (last wins).
 */
export function registerBrowserExitCallback(cb: BrowserExitCallback): void {
  browserExitCallback = cb
}

/**
 * Get list of running browser profiles
 */
export function getRunningProfiles(): string[] {
  const running: string[] = []
  for (const [profileId, proc] of runningProcesses) {
    try {
      process.kill(proc.pid ?? 0, 0)
      running.push(profileId)
    } catch {
      // Process is dead, clean up
      runningProcesses.delete(profileId)
      stopMcpSidecar(profileId)
      updateProfileStatus(profileId, 'idle')
    }
  }
  return running
}

/**
 * Stop all running browsers
 */
export function stopAllBrowsers(): void {
  for (const profileId of runningProcesses.keys()) {
    stopBrowser(profileId)
  }
  for (const profileId of mcpSidecarProcesses.keys()) {
    stopMcpSidecar(profileId)
  }
  stopAllGost()
}

/**
 * Extended launch options for MCP
 */
export interface LaunchWithMcpExtendedOptions extends LaunchWithMcpOptions {
  /** Custom browser configuration */
  browserConfig?: BrowserConfig
}

/**
 * Launch a browser with MCP support
 *
 * This is a convenience wrapper that launches the browser and optionally
 * waits for the MCP server to become available.
 *
 * @param profile - Browser profile configuration
 * @param options - MCP launch options
 * @returns Launch result with MCP connection status
 */
export async function launchBrowserWithMcp(
  profile: BrowserProfileConfig,
  options?: LaunchWithMcpExtendedOptions,
): Promise<LaunchWithMcpResult> {
  // Import dynamically to avoid circular dependencies
  const { discoverMcpPort, waitForMcpServer, DEFAULT_MCP_PORT_RANGE } =
    await import('./mcp-port-discovery.ts')
  const { ProfileMcpConnectionManager } = await import(
    './mcp-connection-manager.ts'
  )

  // Launch browser first (with browser config if provided)
  const launchResult = await launchBrowser(profile, {
    browserConfig: options?.browserConfig,
  })

  if (!launchResult.success) {
    return {
      ...launchResult,
      mcpConnected: false,
    }
  }

  // If not waiting for MCP, return early
  if (!options?.waitForMcp) {
    return {
      ...launchResult,
      mcpConnected: false,
    }
  }

  const timeout = options.mcpTimeout || 30000
  const portRange = options.portRange || DEFAULT_MCP_PORT_RANGE

  // Wait a bit for browser to initialize
  await new Promise((resolve) => setTimeout(resolve, 2000))

  // Try to discover MCP port
  let mcpPort = options.mcpPort

  if (!mcpPort) {
    const discovery = await discoverMcpPort(profile.userDataDir, profile.mcp)

    if (discovery.success && discovery.port) {
      mcpPort = discovery.port
    } else {
      // Try scanning the port range
      const host = profile.mcp?.host || '127.0.0.1'

      for (let port = portRange.min; port <= portRange.max; port++) {
        const ready = await waitForMcpServer(port, host, 1000)
        if (ready) {
          mcpPort = port
          break
        }
      }
    }
  }

  if (!mcpPort) {
    return {
      ...launchResult,
      mcpConnected: false,
      error: 'Could not discover MCP port',
    }
  }

  // Wait for MCP server to be ready
  const serverReady = await waitForMcpServer(
    mcpPort,
    profile.mcp?.host || '127.0.0.1',
    timeout,
  )

  if (!serverReady) {
    return {
      ...launchResult,
      mcpConnected: false,
      mcpPort,
      error: `MCP server not responding on port ${mcpPort}`,
    }
  }

  // Create connection manager and connect
  const manager = new ProfileMcpConnectionManager()
  const connected = await manager.connect(profile, { port: mcpPort })

  return {
    ...launchResult,
    mcpConnected: connected,
    mcpPort,
    mcpState: manager.getState(profile.id),
  }
}
