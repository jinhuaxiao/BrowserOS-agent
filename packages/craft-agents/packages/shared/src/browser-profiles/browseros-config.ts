/**
 * BrowserOS Kernel-Level Configuration
 *
 * Generates fingerprint configuration files that can be loaded by
 * the patched BrowserOS kernel at runtime via the BROWSEROS_FINGERPRINT_CONFIG
 * environment variable.
 *
 * This enables kernel-level fingerprint spoofing which is more robust than
 * JavaScript-based injection as it modifies the actual browser API implementations.
 */

import { execSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { homedir, platform as osPlatform } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { getConfigCache } from './config-cache.ts'
import { DEFAULT_FONTS, FONTS } from './fingerprint-data.ts'
import { getProfilePath } from './storage.ts'
import type { FingerprintConfig } from './types.ts'

/**
 * Profile badge display options
 */
export interface ProfileBadgeConfig {
  /** Profile display name (shown in address bar badge) */
  name: string
  /** Badge background color in hex format (#RRGGBB) */
  color?: string
}

/**
 * Preset colors for different e-commerce platforms
 */
export const PLATFORM_COLORS: Record<string, string> = {
  amazon_us: '#2196F3', // Blue
  amazon_eu: '#4CAF50', // Green
  amazon_jp: '#F44336', // Red
  amazon_uk: '#9C27B0', // Purple
  ebay: '#FFC107', // Yellow
  shopee: '#FF5722', // Deep Orange
  lazada: '#FF9800', // Orange
  aliexpress: '#E91E63', // Pink
  etsy: '#795548', // Brown
  walmart: '#03A9F4', // Light Blue
  default: '#607D8B', // Blue Grey
}

/**
 * BrowserOS kernel configuration format (legacy key=value)
 * Newer builds prefer JSON via fingerprintToChromiumJson().
 */
export interface BrowserOSKernelConfig {
  // Profile identification (for address bar badge)
  profile_id: string
  profile_name: string
  profile_color: string

  // Navigator properties
  user_agent: string
  hardware_concurrency: number
  device_memory: number
  platform: string
  vendor: string
  language: string
  languages: string
  accept_language: string

  // Screen properties
  screen_width: number
  screen_height: number
  screen_avail_width: number
  screen_avail_height: number
  screen_color_depth: number
  screen_pixel_depth: number
  device_pixel_ratio: number

  // WebGL properties
  webgl_vendor: string
  webgl_renderer: string
  webgl_unmasked_vendor: string
  webgl_unmasked_renderer: string
  webgl_gl_version: string
  webgl_shading_language_version: string

  // Canvas noise
  canvas_noise_enabled: string
  canvas_noise_level: number
  canvas_session_seed: number

  // Audio noise
  audio_noise_enabled: string
  audio_noise_level: number
  audio_session_seed: number

  // WebRTC
  webrtc_disabled: string
  webrtc_public_ip: string
  webrtc_local_ip: string

  // Fonts
  block_font_enumeration: string
  fonts_enabled: string
}

/**
 * Options for kernel config generation
 */
export interface KernelConfigOptions {
  /** Profile badge configuration */
  badge?: ProfileBadgeConfig
  /** E-commerce platform (for auto color selection) */
  platform?: string
}

/** Default badge color */
const DEFAULT_BADGE_COLOR = '#607D8B'

/**
 * Per-platform UI fonts for kernel allowlists.
 * Split by OS to avoid leaking macOS fonts into Windows profiles (and vice versa).
 */
const REQUIRED_UI_FONTS_BY_PLATFORM: Record<string, string[]> = {
  windows: [
    'system-ui',
    'Arial',
    'Helvetica',
    'Segoe UI',
    'Segoe UI Emoji',
    'Trebuchet MS',
    'Calibri',
    'Times',
    'Roboto',
    'Inter',
    'Consolas',
    'Noto Sans',
    'Noto Serif',
    'Noto Color Emoji',
    'Microsoft YaHei',
  ],
  macos: [
    'system-ui',
    '-apple-system',
    'BlinkMacSystemFont',
    'Arial',
    'Helvetica',
    'Helvetica Neue',
    'Times',
    'Roboto',
    'Inter',
    'SF Mono',
    'SF Pro Text',
    'SF Pro Display',
    'Menlo',
    'Noto Sans',
    'Noto Serif',
    'Noto Color Emoji',
    'Apple Color Emoji',
    'PingFang SC',
    'Hiragino Sans GB',
  ],
  linux: [
    'system-ui',
    'Arial',
    'Helvetica',
    'Times',
    'Roboto',
    'Inter',
    'Ubuntu',
    'Cantarell',
    'Noto Sans',
    'Noto Serif',
    'Noto Color Emoji',
  ],
}

function getRequiredUiFonts(targetPlatform: string): string[] {
  return (
    REQUIRED_UI_FONTS_BY_PLATFORM[targetPlatform] ??
    REQUIRED_UI_FONTS_BY_PLATFORM.windows
  )
}

function getPlatformFontPool(targetPlatform: string): string[] {
  const required = getRequiredUiFonts(targetPlatform)
  const platformFonts = FONTS[targetPlatform] ?? FONTS.windows ?? []
  const defaults = DEFAULT_FONTS[targetPlatform] ?? DEFAULT_FONTS.windows ?? []
  return Array.from(new Set([...required, ...platformFonts, ...defaults]))
}

const KERNEL_CONFIG_FORMAT_VERSION = 6
let cachedInstalledFontPool: string[] | null = null
const MIN_TARGET_FONT_COUNT = 320
const MAX_TARGET_FONT_COUNT = 380
const FONT_DIR_SCAN_MAX_DEPTH = 4
const FONT_DIR_SCAN_MAX_ENTRIES = 12000

function getSystemFontDirs(): string[] {
  const dirs = new Set<string>()
  const home = homedir()
  const currentPlatform = osPlatform()

  if (currentPlatform === 'darwin') {
    dirs.add('/System/Library/Fonts')
    dirs.add('/Library/Fonts')
    dirs.add(join(home, 'Library/Fonts'))
  } else if (currentPlatform === 'linux') {
    dirs.add('/usr/share/fonts')
    dirs.add('/usr/local/share/fonts')
    dirs.add(join(home, '.fonts'))
    dirs.add(join(home, '.local/share/fonts'))
  } else if (currentPlatform === 'win32') {
    dirs.add('C:\\Windows\\Fonts')
  }

  return Array.from(dirs)
}

function discoverFontFilesRecursively(rootDir: string): string[] {
  const files: string[] = []
  if (!existsSync(rootDir)) {
    return files
  }

  const stack: Array<{ dir: string; depth: number }> = [
    { dir: rootDir, depth: 0 },
  ]
  let scannedEntries = 0

  while (stack.length > 0 && scannedEntries < FONT_DIR_SCAN_MAX_ENTRIES) {
    const current = stack.pop()
    if (!current) continue

    try {
      const entries = readdirSync(current.dir, { withFileTypes: true })
      for (const entry of entries) {
        scannedEntries++
        if (scannedEntries >= FONT_DIR_SCAN_MAX_ENTRIES) {
          break
        }

        const fullPath = join(current.dir, entry.name)
        if (entry.isDirectory()) {
          if (current.depth < FONT_DIR_SCAN_MAX_DEPTH) {
            stack.push({ dir: fullPath, depth: current.depth + 1 })
          }
          continue
        }

        if (!entry.isFile()) {
          continue
        }

        if (/\.(ttf|otf|ttc|dfont|woff2?)$/i.test(entry.name)) {
          files.push(entry.name)
        }
      }
    } catch {
      // Ignore scan failures for individual directories.
    }
  }

  return files
}

function normalizeFontFileNameToFamily(fileName: string): string | null {
  const raw = basename(
    fileName,
    fileName.includes('.') ? fileName.slice(fileName.lastIndexOf('.')) : '',
  )
  const noStyle = raw
    .replace(/[-_]/g, ' ')
    .replace(
      /\b(?:thin|extralight|ultralight|light|regular|book|roman|medium|semibold|demibold|bold|extrabold|ultrabold|black|heavy|italic|oblique|condensed|narrow)\b/gi,
      ' ',
    )
    .replace(/\s+/g, ' ')
    .trim()
  return noStyle.length > 1 ? noStyle : null
}

function discoverInstalledFonts(): string[] {
  const discovered = new Set<string>()

  // Primary source: fontconfig family names.
  try {
    const output = execSync('fc-list : family', {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    const lines = output.split('\n')
    for (const line of lines) {
      const names = line.split(',')
      for (const name of names) {
        const n = name.trim()
        if (n.length > 0) {
          discovered.add(n)
        }
      }
    }
  } catch {
    // Continue with filesystem fallback.
  }

  // Fallback source: derive family names from common font directories.
  const fontDirs = getSystemFontDirs()
  for (const dir of fontDirs) {
    const files = discoverFontFilesRecursively(dir)
    for (const fileName of files) {
      const family = normalizeFontFileNameToFamily(fileName)
      if (family) {
        discovered.add(family)
      }
    }
  }

  return Array.from(discovered)
}

/**
 * Build the font fill pool for the kernel config.
 *
 * When the host OS matches the target profile platform, we include locally
 * installed fonts (so the browser can actually render them). When the host
 * differs (e.g. macOS host → Windows profile), we only use the static
 * platform font list to avoid leaking host-OS fonts into the profile.
 */
function getKernelFontPool(targetPlatform: string): string[] {
  if (!cachedInstalledFontPool) {
    cachedInstalledFontPool = discoverInstalledFonts()
  }
  const platformPool = getPlatformFontPool(targetPlatform)

  const hostPlatform =
    osPlatform() === 'darwin'
      ? 'macos'
      : osPlatform() === 'win32'
        ? 'windows'
        : 'linux'

  if (hostPlatform === targetPlatform) {
    return Array.from(new Set([...platformPool, ...cachedInstalledFontPool]))
  }
  // Cross-platform: only use the static platform font pool, not host system fonts.
  return platformPool
}

function seededFontSample(
  seedKey: string,
  pool: string[],
  count: number,
): string[] {
  if (count <= 0 || pool.length === 0) {
    return []
  }

  const selected: string[] = []
  const candidates = [...pool]
  let state =
    parseInt(
      createHash('sha256').update(seedKey).digest('hex').slice(0, 8),
      16,
    ) >>> 0

  const next = (): number => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state
  }

  while (selected.length < count && candidates.length > 0) {
    const idx = next() % candidates.length
    const font = candidates[idx]
    if (font !== undefined) {
      selected.push(font)
    }
    candidates.splice(idx, 1)
  }

  return selected
}

function normalizeKernelFonts(fingerprint: FingerprintConfig): {
  blockFontEnumeration: boolean
  enabledFonts: string[]
} {
  const configured = fingerprint.fonts ?? {
    blockFontEnumeration: false,
    enabledFonts: [],
  }

  // Detect target platform from navigator.platform
  const navPlatform = fingerprint.navigator?.platform ?? 'Win32'
  const targetPlatform =
    navPlatform === 'MacIntel'
      ? 'macos'
      : navPlatform.startsWith('Linux')
        ? 'linux'
        : 'windows'

  const requiredFonts = getRequiredUiFonts(targetPlatform)
  const fontPool = getKernelFontPool(targetPlatform)
  const configuredFonts = configured.enabledFonts
    .map((font) => font.trim())
    .filter((font) => font.length > 0)
  const keepSet = new Set<string>([...requiredFonts, ...configuredFonts])
  const normalizedSet = new Set<string>(keepSet)

  const targetCount = Math.min(
    fontPool.length,
    Math.max(
      MIN_TARGET_FONT_COUNT,
      Math.min(MAX_TARGET_FONT_COUNT, keepSet.size + 280),
    ),
  )

  if (normalizedSet.size < targetCount) {
    const fillPool = fontPool.filter((font) => !normalizedSet.has(font))
    const fillCount = targetCount - normalizedSet.size
    const fill = seededFontSample(
      `${fingerprint.profileId}:font-fill`,
      fillPool,
      fillCount,
    )
    for (const font of fill) {
      normalizedSet.add(font)
    }
  }

  // Keep almost all fonts, only remove a tiny deterministic subset per profile.
  const removablePool = Array.from(normalizedSet).filter(
    (font) => !keepSet.has(font),
  )
  const dropCount = Math.min(
    removablePool.length,
    Math.max(2, Math.min(8, Math.floor(removablePool.length * 0.03))),
  )
  const toDrop = new Set(
    seededFontSample(
      `${fingerprint.profileId}:font-drop`,
      removablePool,
      dropCount,
    ),
  )

  for (const font of toDrop) {
    normalizedSet.delete(font)
  }

  return {
    blockFontEnumeration: configured.blockFontEnumeration,
    enabledFonts: Array.from(normalizedSet),
  }
}

/**
 * Get color for a platform
 */
export function getPlatformColor(platform?: string): string {
  if (!platform) return PLATFORM_COLORS.default ?? DEFAULT_BADGE_COLOR
  const key = platform.toLowerCase().replace(/[^a-z]/g, '_')
  return PLATFORM_COLORS[key] ?? PLATFORM_COLORS.default ?? DEFAULT_BADGE_COLOR
}

/**
 * Convert FingerprintConfig to BrowserOS kernel configuration
 */
export function fingerprintToKernelConfig(
  fingerprint: FingerprintConfig,
  options?: KernelConfigOptions,
): BrowserOSKernelConfig {
  // Generate a session-specific seed for consistent noise
  const sessionSeed = fingerprint.canvas.noiseSeed || Date.now()

  // Determine profile badge color
  const badgeColor =
    options?.badge?.color ??
    (options?.platform
      ? getPlatformColor(options.platform)
      : getPlatformColor())

  const _mediaDevices = fingerprint.mediaDevices?.devices ?? []
  const _plugins = fingerprint.plugins?.items ?? []
  const kernelFonts = normalizeKernelFonts(fingerprint)

  // Use plain language codes - no quality weights (;q=X) to avoid Chromium DCHECK crash
  const acceptLanguage = fingerprint.navigator.languages.join(',')

  return {
    // Profile identification (for address bar badge)
    profile_id: fingerprint.profileId,
    profile_name: options?.badge?.name || '',
    profile_color: badgeColor,

    // Navigator
    user_agent: fingerprint.navigator.userAgent,
    hardware_concurrency: fingerprint.navigator.hardwareConcurrency,
    device_memory: fingerprint.navigator.deviceMemory,
    platform: fingerprint.navigator.platform,
    vendor: fingerprint.navigator.vendor || 'Google Inc.',
    language: fingerprint.navigator.language,
    languages: fingerprint.navigator.languages.join(','),
    accept_language: acceptLanguage,

    // Screen
    screen_width: fingerprint.screen.width,
    screen_height: fingerprint.screen.height,
    screen_avail_width: fingerprint.screen.availWidth,
    screen_avail_height: fingerprint.screen.availHeight,
    screen_color_depth: fingerprint.screen.colorDepth,
    screen_pixel_depth: fingerprint.screen.pixelDepth,
    device_pixel_ratio: fingerprint.screen.devicePixelRatio,

    // WebGL
    webgl_vendor: fingerprint.webgl.vendor,
    webgl_renderer: fingerprint.webgl.renderer,
    webgl_unmasked_vendor: fingerprint.webgl.unmaskedVendor,
    webgl_unmasked_renderer: fingerprint.webgl.unmaskedRenderer,
    webgl_gl_version: fingerprint.webgl.glVersion || '',
    webgl_shading_language_version:
      fingerprint.webgl.shadingLanguageVersion || '',

    // Canvas noise
    canvas_noise_enabled: fingerprint.canvas.noiseLevel > 0 ? 'true' : 'false',
    canvas_noise_level: fingerprint.canvas.noiseLevel,
    canvas_session_seed: sessionSeed,

    // Audio noise
    audio_noise_enabled: fingerprint.audio.noiseLevel > 0 ? 'true' : 'false',
    audio_noise_level: fingerprint.audio.noiseLevel,
    audio_session_seed: fingerprint.audio.noiseSeed || sessionSeed,

    // WebRTC
    webrtc_disabled: fingerprint.webrtc.disableWebRTC ? 'true' : 'false',
    webrtc_public_ip: fingerprint.webrtc.publicIp || '',
    webrtc_local_ip: fingerprint.webrtc.localIp || '',

    // Fonts
    block_font_enumeration: kernelFonts.blockFontEnumeration ? 'true' : 'false',
    fonts_enabled: kernelFonts.enabledFonts.join(','),
  }
}

/**
 * Serialize kernel config to key=value format (legacy)
 */
export function serializeKernelConfig(config: BrowserOSKernelConfig): string {
  const lines: string[] = []

  for (const [key, value] of Object.entries(config)) {
    lines.push(`${key}=${value}`)
  }

  return lines.join('\n')
}

/**
 * JSON configuration format expected by Chromium FingerprintConfig
 *
 * Field names derived from: third_party/blink/common/fingerprint/fingerprint_config.cc
 * The kernel supports both camelCase and snake_case for most fields.
 * Navigator fields MUST be nested under a "navigator" key.
 * Canvas/Audio MUST include noiseSeed for per-profile differentiation.
 */
export interface ChromiumFingerprintJson {
  // Profile identification
  profile: {
    profileId: string
    profileName: string
    profileColor: string
  }

  // Navigator properties (MUST be nested)
  navigator: {
    userAgent: string
    platform: string
    vendor: string
    language: string
    languages: string
    acceptLanguage: string
    hardwareConcurrency: number
    deviceMemory: number
  }

  // Screen properties
  screen: {
    width: number
    height: number
    availWidth: number
    availHeight: number
    colorDepth: number
    devicePixelRatio: number
  }

  // WebGL properties
  webgl: {
    vendor: string
    renderer: string
    unmaskedVendor: string
    unmaskedRenderer: string
    glVersion?: string
    shadingLanguageVersion?: string
    shaderPrecision?: FingerprintConfig['webgl']['shaderPrecision']
    params?: Record<string, number | [number, number]>
    extensions?: string[]
  }

  // Canvas noise (noiseSeed is critical for per-profile differentiation)
  canvas: {
    noiseEnabled: boolean
    noiseFactor: number
    noiseSeed: number
  }

  // Audio noise (noiseSeed is critical for per-profile differentiation)
  audio: {
    noiseEnabled: boolean
    noiseFactor: number
    noiseSeed: number
  }

  // WebRTC
  webrtc?: {
    disableWebRTC: boolean
    publicIp: string | null
    localIp: string | null
  }

  // Fonts
  fonts?: {
    blockFontEnumeration: boolean
    enabledFonts: string[]
  }

  // Media devices
  mediaDevices?: {
    devices: FingerprintConfig['mediaDevices']['devices']
  }

  // Plugins
  plugins?: {
    items: FingerprintConfig['plugins']['items']
  }

  // ClientRects noise
  clientRects?: {
    noiseEnabled: boolean
    noiseFactor: number
    noiseSeed: number
  }

  // Battery API
  battery?: {
    enabled: boolean
    charging: boolean
    chargingTime: number
    dischargingTime: number | string
    level: number
  }

  // Geolocation
  geolocation?: {
    enabled: boolean
    latitude: number
    longitude: number
    accuracy: number
  }

  // Speech synthesis
  speechSynthesis?: {
    enabled: boolean
    voices: Array<{
      name: string
      lang: string
      localService: boolean
      default: boolean
    }>
  }

  // WebGPU adapter info
  webgpu?: {
    vendor: string
    architecture: string
    device: string
    description: string
  }

  // Port scan protection
  portScanProtection?: boolean

  // Port scan whitelist — ports that bypass port scan protection
  portScanWhitelist?: number[]

  // TLS profile
  tls?: {
    profile: string
  }
}

/**
 * Convert FingerprintConfig to Chromium JSON format
 */
export function fingerprintToChromiumJson(
  fingerprint: FingerprintConfig,
  options?: KernelConfigOptions,
): ChromiumFingerprintJson {
  const badgeColor =
    options?.badge?.color ??
    (options?.platform
      ? getPlatformColor(options.platform)
      : getPlatformColor())

  const mediaDevices = fingerprint.mediaDevices?.devices ?? []
  const plugins = fingerprint.plugins?.items ?? []
  const kernelFonts = normalizeKernelFonts(fingerprint)

  // Use plain language codes for acceptLanguage to avoid Chromium DCHECK crash.
  // The kernel config is passed via --fingerprint-config and must not contain
  // HTTP quality weights like ";q=0.9" as they may be used in HTTP header generation.
  const acceptLanguage = fingerprint.navigator.languages.join(',')

  // Generate session seeds for canvas/audio noise per-profile
  const canvasSeed = fingerprint.canvas.noiseSeed || Date.now()
  const audioSeed = fingerprint.audio.noiseSeed || canvasSeed + 1

  return {
    // Profile identification (nested under "profile" key)
    profile: {
      profileId: fingerprint.profileId,
      profileName: options?.badge?.name || '',
      profileColor: badgeColor,
    },

    // Navigator properties (MUST be nested - kernel looks for navigator.userAgent etc.)
    navigator: {
      userAgent: fingerprint.navigator.userAgent,
      platform: fingerprint.navigator.platform,
      vendor: fingerprint.navigator.vendor || 'Google Inc.',
      language: fingerprint.navigator.language,
      languages: fingerprint.navigator.languages.join(','),
      acceptLanguage,
      hardwareConcurrency: fingerprint.navigator.hardwareConcurrency,
      deviceMemory: fingerprint.navigator.deviceMemory,
    },

    screen: {
      width: fingerprint.screen.width,
      height: fingerprint.screen.height,
      availWidth: fingerprint.screen.availWidth,
      availHeight: fingerprint.screen.availHeight,
      colorDepth: fingerprint.screen.colorDepth,
      devicePixelRatio: fingerprint.screen.devicePixelRatio,
    },
    webgl: {
      vendor: fingerprint.webgl.vendor,
      renderer: fingerprint.webgl.renderer,
      unmaskedVendor: fingerprint.webgl.unmaskedVendor,
      unmaskedRenderer: fingerprint.webgl.unmaskedRenderer,
      ...(fingerprint.webgl.glVersion
        ? { glVersion: fingerprint.webgl.glVersion }
        : {}),
      ...(fingerprint.webgl.shadingLanguageVersion
        ? { shadingLanguageVersion: fingerprint.webgl.shadingLanguageVersion }
        : {}),
      ...(fingerprint.webgl.shaderPrecision
        ? { shaderPrecision: fingerprint.webgl.shaderPrecision }
        : {}),
      ...(fingerprint.webgl.params ? { params: fingerprint.webgl.params } : {}),
      ...(fingerprint.webgl.extensions
        ? { extensions: fingerprint.webgl.extensions }
        : {}),
    },
    canvas: {
      noiseEnabled: fingerprint.canvas.noiseLevel > 0,
      noiseFactor: fingerprint.canvas.noiseLevel,
      noiseSeed: canvasSeed,
    },
    audio: {
      noiseEnabled: fingerprint.audio.noiseLevel > 0,
      noiseFactor: fingerprint.audio.noiseLevel,
      noiseSeed: audioSeed,
    },
    webrtc: {
      disableWebRTC: fingerprint.webrtc.disableWebRTC,
      publicIp: fingerprint.webrtc.publicIp,
      localIp: fingerprint.webrtc.localIp,
    },
    fonts: {
      blockFontEnumeration: kernelFonts.blockFontEnumeration,
      enabledFonts: kernelFonts.enabledFonts,
    },
    mediaDevices:
      mediaDevices.length > 0 ? { devices: mediaDevices } : undefined,
    plugins: plugins.length > 0 ? { items: plugins } : undefined,

    // ClientRects
    clientRects: fingerprint.clientRects
      ? {
          noiseEnabled: fingerprint.clientRects.noiseLevel > 0,
          noiseFactor: fingerprint.clientRects.noiseLevel,
          noiseSeed: fingerprint.clientRects.noiseSeed,
        }
      : undefined,

    // Battery
    battery: fingerprint.battery
      ? {
          enabled: true,
          charging: fingerprint.battery.charging,
          chargingTime: fingerprint.battery.chargingTime,
          dischargingTime:
            fingerprint.battery.dischargingTime === Infinity
              ? 'Infinity'
              : fingerprint.battery.dischargingTime,
          level: fingerprint.battery.level,
        }
      : undefined,

    // Geolocation
    geolocation: fingerprint.geolocation
      ? {
          enabled: fingerprint.geolocation.enabled,
          latitude: fingerprint.geolocation.latitude,
          longitude: fingerprint.geolocation.longitude,
          accuracy: fingerprint.geolocation.accuracy,
        }
      : undefined,

    // Speech synthesis
    speechSynthesis: fingerprint.speechSynthesis
      ? {
          enabled: true,
          voices: fingerprint.speechSynthesis.voices,
        }
      : undefined,

    // WebGPU adapter info
    webgpu: fingerprint.webgpu
      ? {
          vendor: fingerprint.webgpu.vendor,
          architecture: fingerprint.webgpu.architecture,
          device: fingerprint.webgpu.device,
          description: fingerprint.webgpu.description,
        }
      : undefined,

    // Port scan protection
    portScanProtection: fingerprint.portScanProtection ?? undefined,

    // Port scan whitelist
    portScanWhitelist: fingerprint.portScanWhitelist?.length
      ? fingerprint.portScanWhitelist
      : undefined,

    // TLS profile
    tls: fingerprint.tlsProfile
      ? {
          profile: fingerprint.tlsProfile,
        }
      : undefined,
  }
}

/**
 * Get the path for BrowserOS kernel config file (JSON format)
 */
export function getBrowserOSConfigPath(profileId: string): string {
  const profileDir = getProfilePath(profileId)
  return join(profileDir, 'fingerprint_config.json')
}

/**
 * Options for writing browser config
 */
export interface WriteBrowserOSConfigOptions {
  /** Profile display name (shown in address bar badge) */
  profileName?: string
  /** Badge color in hex format (#RRGGBB) */
  badgeColor?: string
  /** E-commerce platform (for auto color selection) */
  platform?: string
}

/**
 * Generate a hash of fingerprint config for change detection
 */
function hashFingerprintConfig(
  fingerprint: FingerprintConfig,
  options?: WriteBrowserOSConfigOptions,
): string {
  const data = JSON.stringify({
    version: KERNEL_CONFIG_FORMAT_VERSION,
    fingerprint,
    options,
  })
  return createHash('sha256').update(data).digest('hex').slice(0, 16)
}

/**
 * Result of cached config write
 */
export interface CachedWriteResult {
  /** Path to config file */
  path: string

  /** Whether the config was actually written (false if cached) */
  written: boolean

  /** Whether cache was used */
  cached: boolean
}

/**
 * Write BrowserOS kernel configuration file for a profile
 *
 * @param profileId - Profile identifier
 * @param fingerprint - Fingerprint configuration to convert
 * @param options - Optional profile display settings
 * @returns Path to the generated config file
 */
export function writeBrowserOSConfig(
  profileId: string,
  fingerprint: FingerprintConfig,
  options?: WriteBrowserOSConfigOptions,
): string {
  const configPath = getBrowserOSConfigPath(profileId)

  // Ensure directory exists
  const dir = dirname(configPath)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }

  // Build kernel config options
  const kernelOptions: KernelConfigOptions = {
    platform: options?.platform,
  }

  if (options?.profileName) {
    kernelOptions.badge = {
      name: options.profileName,
      color: options.badgeColor,
    }
  }

  // Convert to Chromium JSON format (used by the patched Chromium)
  const jsonConfig = fingerprintToChromiumJson(fingerprint, kernelOptions)

  // Write as JSON
  const content = JSON.stringify(jsonConfig, null, 2)
  writeFileSync(configPath, content, 'utf-8')

  console.log(`[Nova Seller] Fingerprint config written to: ${configPath}`)
  return configPath
}

/**
 * Write BrowserOS kernel configuration file with caching
 *
 * Skips writing if the fingerprint configuration hasn't changed since last write.
 * Uses both in-memory cache and file hash comparison for change detection.
 *
 * @param profileId - Profile identifier
 * @param fingerprint - Fingerprint configuration to convert
 * @param options - Optional profile display settings
 * @returns Result including path and whether file was actually written
 */
export function writeBrowserOSConfigCached(
  profileId: string,
  fingerprint: FingerprintConfig,
  options?: WriteBrowserOSConfigOptions,
): CachedWriteResult {
  const configPath = getBrowserOSConfigPath(profileId)
  const cacheKey = `browseros-config:${profileId}`
  const configCache = getConfigCache()

  // Calculate hash of current config
  const currentHash = hashFingerprintConfig(fingerprint, options)

  // Check in-memory cache first
  const cacheResult = configCache.get<string>(cacheKey, {
    fingerprint,
    options,
  })

  if (cacheResult.hit && cacheResult.data === currentHash) {
    // Config hasn't changed, skip writing
    return {
      path: configPath,
      written: false,
      cached: true,
    }
  }

  // Check if existing file matches (in case cache was cleared but file exists)
  if (existsSync(configPath)) {
    try {
      const existingContent = readFileSync(configPath, 'utf-8')
      const _existingConfig = JSON.parse(existingContent)

      // Compare essential fields
      const kernelOptions: KernelConfigOptions = {
        platform: options?.platform,
      }
      if (options?.profileName) {
        kernelOptions.badge = {
          name: options.profileName,
          color: options.badgeColor,
        }
      }

      const newConfig = fingerprintToChromiumJson(fingerprint, kernelOptions)
      const newContent = JSON.stringify(newConfig, null, 2)

      if (existingContent === newContent) {
        // File matches, update cache and skip writing
        configCache.set(cacheKey, { fingerprint, options }, currentHash)
        return {
          path: configPath,
          written: false,
          cached: true,
        }
      }
    } catch {
      // File exists but can't be read/parsed, proceed with writing
    }
  }

  // Write the config
  const path = writeBrowserOSConfig(profileId, fingerprint, options)

  // Update cache
  configCache.set(cacheKey, { fingerprint, options }, currentHash)

  return {
    path,
    written: true,
    cached: false,
  }
}

/**
 * Check if BrowserOS is available
 */
export function isBrowserOSAvailable(): boolean {
  const { existsSync } = require('node:fs')
  const { platform } = require('node:os')

  const currentPlatform = platform()

  const browserOSPaths: Record<string, string[]> = {
    darwin: [
      '/Applications/Nova Seller.app/Contents/MacOS/Nova Seller',
      '/Applications/BrowserOS.app/Contents/MacOS/BrowserOS',
    ],
    linux: [
      '/usr/bin/novaseller',
      '/opt/novaseller/novaseller',
      '/usr/bin/browseros',
      '/opt/browseros/browseros',
    ],
    win32: [
      'C:\\Program Files\\Nova Seller\\Nova Seller.exe',
      'C:\\Program Files\\BrowserOS\\BrowserOS.exe',
    ],
  }

  const paths = browserOSPaths[currentPlatform] || []
  return paths.some((p) => existsSync(p))
}

/**
 * Get BrowserOS executable path
 */
export function getBrowserOSPath(): string | null {
  const { existsSync } = require('node:fs')
  const { platform } = require('node:os')

  const currentPlatform = platform()

  const browserOSPaths: Record<string, string[]> = {
    darwin: [
      '/Applications/Nova Seller.app/Contents/MacOS/Nova Seller',
      '/Applications/BrowserOS.app/Contents/MacOS/BrowserOS',
    ],
    linux: [
      '/usr/bin/novaseller',
      '/opt/novaseller/novaseller',
      '/usr/bin/browseros',
      '/opt/browseros/browseros',
    ],
    win32: [
      'C:\\Program Files\\Nova Seller\\Nova Seller.exe',
      'C:\\Program Files\\BrowserOS\\BrowserOS.exe',
    ],
  }

  const paths = browserOSPaths[currentPlatform] || []
  for (const p of paths) {
    if (existsSync(p)) {
      return p
    }
  }

  return null
}

/**
 * Build launch arguments for BrowserOS with kernel-level fingerprint config
 *
 * @param profileId - Profile identifier
 * @param fingerprint - Fingerprint configuration
 * @param additionalArgs - Additional browser arguments
 * @returns Array of launch arguments
 */
export function buildBrowserOSLaunchArgs(
  profileId: string,
  fingerprint: FingerprintConfig,
  additionalArgs: string[] = [],
): { args: string[]; env: NodeJS.ProcessEnv } {
  // Write kernel config and get path
  const configPath = writeBrowserOSConfig(profileId, fingerprint)

  // Build arguments
  const args: string[] = [...additionalArgs]

  // BrowserOS-specific argument to load fingerprint config
  args.push(`--fingerprint-config=${configPath}`)
  try {
    const base64 = readFileSync(configPath).toString('base64')
    if (base64) {
      args.push(`--fingerprint-config-base64=${base64}`)
    }
  } catch {
    // Ignore base64 generation errors and fall back to file path
  }

  // Prepare environment with config path
  const env = { ...process.env }
  env.NOVA_SELLER_FINGERPRINT_CONFIG = configPath
  env.BROWSEROS_FINGERPRINT_CONFIG = configPath

  // Set timezone from fingerprint
  if (fingerprint.timezone?.name) {
    env.TZ = fingerprint.timezone.name
  }

  return { args, env }
}

/**
 * TLS profile types for JA3/JA4 fingerprinting
 */
export type TLSProfile = 'chrome' | 'firefox' | 'safari'

/**
 * Set TLS fingerprint profile
 * This affects the JA3/JA4 fingerprint by changing cipher suite ordering
 */
export function setTLSProfile(profile: TLSProfile): NodeJS.ProcessEnv {
  return {
    ...process.env,
    BROWSEROS_TLS_PROFILE: profile,
  }
}
