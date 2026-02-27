/**
 * Fingerprint Generator
 *
 * Generates realistic and consistent browser fingerprints for profiles.
 */

import { createHash } from 'node:crypto'
import {
  generateUserAgentFromVersion,
  type UserAgentInfo,
} from './browser-version.ts'
import {
  CITY_COORDINATES,
  COUNTRY_LANGUAGES,
  DEFAULT_FONTS,
  DEFAULT_PLUGINS,
  FONTS,
  HARDWARE_CONCURRENCY,
  LANGUAGES,
  MEDIA_DEVICES,
  SCREEN_RESOLUTIONS,
  SPEECH_VOICES_BY_PLATFORM,
  TIMEZONES,
  USER_AGENTS,
  WEBGL_DATA_BY_PLATFORM,
} from './fingerprint-data.ts'
import { getTimezoneOffsetDynamic } from './geolocation-service.ts'
import type {
  AudioConfig,
  BatteryConfig,
  CanvasConfig,
  ClientRectsConfig,
  FingerprintConfig,
  FontConfig,
  GeoLocation,
  GeolocationConfig,
  MediaDevicesConfig,
  NavigatorConfig,
  PluginsConfig,
  ProxyConfig,
  ScreenConfig,
  SpeechSynthesisConfig,
  TimezoneConfig,
  WebGLConfig,
  WebRTCConfig,
} from './types.ts'

/**
 * Fonts that are commonly used by extension/app UIs and web pages.
 * We keep these in the baseline to reduce text rendering regressions.
 */
const SAFE_UI_FONTS = [
  'system-ui',
  '-apple-system',
  'BlinkMacSystemFont',
  'Arial',
  'Helvetica',
  'Helvetica Neue',
  'Segoe UI',
  'Segoe UI Emoji',
  'Trebuchet MS',
  'Arial Rounded MT Bold',
  'Calibri',
  'Times',
  'Apple Color Emoji',
  'Noto Sans',
  'Noto Serif',
  'Noto Color Emoji',
  'Roboto',
  'Open Sans',
  'Inter',
  'JetBrains Mono',
  'SF Mono',
  'SF Pro Text',
  'SF Pro Display',
  'System UI',
  'Times New Roman',
  'Georgia',
  'Courier New',
  'Consolas',
  'Menlo',
  'Monaco',
  'Ubuntu',
  'Cantarell',
  'PingFang SC',
  'Hiragino Sans GB',
  'Microsoft YaHei',
]

/**
 * Simple seeded random number generator (Mulberry32)
 */
function createSeededRandom(seed: number): () => number {
  return () => {
    seed += 0x6d2b79f5
    let t = seed
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Get a seed from a string
 */
function stringToSeed(str: string): number {
  const hash = createHash('md5').update(str).digest('hex')
  return parseInt(hash.slice(0, 8), 16)
}

function hashToId(value: string): string {
  return createHash('md5').update(value).digest('hex').slice(0, 16)
}

/**
 * Random choice from array using seeded random
 */
function randomChoice<T>(array: T[], random: () => number): T {
  const index = Math.floor(random() * array.length)
  return array[index] as T
}

/**
 * Random sample from array using seeded random
 */
function randomSample<T>(array: T[], count: number, random: () => number): T[] {
  const shuffled = [...array].sort(() => random() - 0.5)
  return shuffled.slice(0, Math.min(count, array.length))
}

export interface GeneratorOptions {
  profileId: string
  targetPlatform?: 'windows' | 'macos' | 'linux'
  targetRegion?: 'us' | 'eu' | 'asia' | 'oceania'
  proxy?: ProxyConfig
  seed?: number
  /**
   * Geolocation information from proxy IP detection.
   * If provided, timezone and language will be matched to this location
   * (takes priority over targetRegion).
   */
  geoLocation?: GeoLocation
  /**
   * Chrome browser version string (e.g., "142.0.6367.91").
   * If provided, User Agent will be dynamically generated to match this version.
   * This prevents fingerprint detection sites from flagging version mismatches
   * between the User Agent string and the actual browser version detected via JS APIs.
   */
  chromeVersion?: string
}

/**
 * Real Chrome stable release versions by major version.
 * Source: https://chromiumdash.appspot.com/releases
 */
const REAL_CHROME_VERSIONS: Record<number, string> = {
  145: '145.0.7422.54',
  144: '144.0.7376.97',
  143: '143.0.7341.93',
  142: '142.0.7313.116',
  141: '141.0.7278.98',
  140: '140.0.7243.122',
  139: '139.0.7208.92',
  138: '138.0.7173.114',
  137: '137.0.7137.92',
  136: '136.0.7103.115',
  135: '135.0.7065.101',
  134: '134.0.7029.97',
  133: '133.0.6993.91',
  132: '132.0.6957.98',
  131: '131.0.6921.96',
  130: '130.0.6885.105',
}

/**
 * Build number ranges for real Chrome stable releases by major version.
 * Used to check if a version is a real Chrome release or a custom Chromium build.
 */
const CHROME_BUILD_RANGES: Record<number, [number, number]> = {
  145: [7400, 7450],
  144: [7350, 7400],
  143: [7310, 7360],
  142: [7280, 7330],
  141: [7250, 7300],
  140: [7210, 7260],
  139: [7180, 7230],
  138: [7140, 7190],
  137: [7100, 7150],
  136: [7070, 7120],
  135: [7030, 7080],
  134: [6990, 7050],
  133: [6960, 7010],
  132: [6920, 6980],
  131: [6880, 6940],
  130: [6850, 6900],
}

/**
 * Normalize a Chrome/Chromium version to a real Chrome stable release.
 *
 * BrowserOS/Nova Seller builds use Chromium build numbers (e.g., 142.0.7444.49)
 * that don't match any Chrome stable release. Detection sites flag these as fake.
 * This function maps custom builds to the closest real Chrome version for the
 * same major version, so UA, Client Hints, and WebGL glVersion are all consistent
 * and pass version database checks.
 */
function normalizeToRealChromeVersion(version?: string): string | undefined {
  if (!version) return undefined

  const match = version.match(/^(\d+)\.(\d+)\.(\d+)(?:\.(\d+))?/)
  if (!match?.[1] || !match?.[3]) return version

  const major = parseInt(match[1], 10)
  const build = parseInt(match[3], 10)

  const range = CHROME_BUILD_RANGES[major]
  if (!range) return version

  const [minBuild, maxBuild] = range
  if (build >= minBuild && build <= maxBuild) {
    return version
  }

  return REAL_CHROME_VERSIONS[major] ?? version
}

/**
 * Generate a complete fingerprint configuration
 */
export function generateFingerprint(
  options: GeneratorOptions,
): FingerprintConfig {
  const {
    profileId,
    targetPlatform = 'windows',
    targetRegion,
    proxy,
    geoLocation,
  } = options

  // Normalize the Chrome version to a real release version.
  // BrowserOS/Nova Seller builds use custom build numbers (e.g., 7444) that
  // don't correspond to any Chrome stable release. Detection sites maintain
  // databases of real Chrome versions and flag unknown build numbers.
  // The same version must be used for UA, Client Hints, AND WebGL glVersion
  // to avoid cross-signal inconsistencies.
  const effectiveVersion = normalizeToRealChromeVersion(options.chromeVersion)

  // Create deterministic random from profile ID
  const seed = options.seed ?? stringToSeed(profileId)
  const random = createSeededRandom(seed)

  const navigator = generateNavigator(
    targetPlatform,
    geoLocation,
    random,
    effectiveVersion,
  )
  const screen = generateScreen(random)
  const webgl = generateWebGL(targetPlatform, random, profileId)
  const timezone = generateTimezone(targetRegion, geoLocation, random)
  const canvas = generateCanvas(profileId, random)
  const audio = generateAudio(profileId, random)
  const webrtc = generateWebRTC(proxy, random)
  const mediaDevices = generateMediaDevices(profileId, targetPlatform)
  const plugins = generatePlugins()
  const fonts = generateFonts(targetPlatform, random)
  const clientRects = generateClientRects(profileId, random)

  return {
    profileId,
    navigator,
    screen,
    webgl,
    timezone,
    canvas,
    audio,
    webrtc,
    mediaDevices,
    plugins,
    fonts,
    clientRects,
    battery: generateBattery(),
    geolocation: generateGeolocation(geoLocation, targetRegion, random),
    speechSynthesis: generateSpeechSynthesis(targetPlatform, random),
    tlsProfile: 'chrome',
    proxy,
  }
}

/**
 * Generate Accept-Language header from languages array
 * Format: "en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7"
 */
function generateAcceptLanguage(languages: string[]): string {
  if (languages.length === 0) {
    return 'en-US,en;q=0.9'
  }

  return languages
    .map((lang, index) => {
      if (index === 0) {
        return lang // First language has implicit q=1.0
      }
      // Decrease quality value for each subsequent language
      const q = Math.max(0.1, 1 - index * 0.1).toFixed(1)
      return `${lang};q=${q}`
    })
    .join(',')
}

function generateNavigator(
  platform: 'windows' | 'macos' | 'linux',
  geoLocation: GeoLocation | undefined,
  random: () => number,
  chromeVersion?: string,
): NavigatorConfig {
  // Map platform to user agent platform string
  const platformMapping: Record<string, string> = {
    windows: 'Win32',
    macos: 'MacIntel',
    linux: 'Linux x86_64',
  }
  const targetPlatformStr = platformMapping[platform]

  // Try to generate User Agent dynamically from Chrome version
  // This ensures the UA string matches the actual browser version
  let ua: UserAgentInfo | null = null
  if (chromeVersion) {
    ua = generateUserAgentFromVersion(chromeVersion, platform)
  }

  // Fall back to static USER_AGENTS pool if dynamic generation fails
  if (!ua) {
    // Filter user agents by platform
    const matchingAgents = USER_AGENTS.filter(
      (agent) => agent.platform === targetPlatformStr,
    )
    const agentPool = matchingAgents.length > 0 ? matchingAgents : USER_AGENTS
    ua = randomChoice(agentPool, random)
  }

  // Select language - prefer geolocation-based language if available
  let lang: { language: string; languages: string[] }
  if (geoLocation?.country) {
    const countryLang = COUNTRY_LANGUAGES[geoLocation.country.toUpperCase()]
    lang = countryLang || randomChoice(LANGUAGES, random)
  } else {
    lang = randomChoice(LANGUAGES, random)
  }

  // Generate Accept-Language header to match JS API
  const acceptLanguage = generateAcceptLanguage(lang.languages)

  // Correlate CPU cores and device memory for realistic hardware combinations
  const cores = randomChoice(HARDWARE_CONCURRENCY, random)
  // navigator.deviceMemory is capped at 8 per Web spec; values above 8 are
  // never returned by real browsers and get flagged by fingerprint detection.
  const memoryOptions: number[] = cores <= 4 ? [4, 8] : [8]
  const memory = randomChoice(memoryOptions, random)

  return {
    userAgent: ua.userAgent,
    platform: ua.platform,
    appVersion: ua.appVersion,
    language: lang.language,
    languages: lang.languages,
    acceptLanguage,
    hardwareConcurrency: cores,
    deviceMemory: memory,
    maxTouchPoints: 0, // Desktop browser
    vendor: 'Google Inc.',
  }
}

function generateScreen(random: () => number): ScreenConfig {
  const resolution = randomChoice(SCREEN_RESOLUTIONS, random)
  const dpr = randomChoice([1.0, 1.25, 1.5, 2.0], random)

  return {
    width: resolution.width,
    height: resolution.height,
    availWidth: resolution.width,
    availHeight: resolution.availHeight,
    colorDepth: 24,
    pixelDepth: 24,
    devicePixelRatio: dpr,
  }
}

function buildAngleGlVersion(profileSeed: string): string {
  // Generate a per-profile ANGLE hash (12 hex chars, like real ANGLE git hashes)
  const hash = createHash('sha256')
    .update(profileSeed)
    .digest('hex')
    .slice(0, 12)
  // Real format from third_party/angle/src/common/angle_version.h:
  // ANGLE_VERSION_STRING = "2.1.1 git hash: <ANGLE_COMMIT_HASH>"
  return `OpenGL ES 2.0.0 (ANGLE 2.1.1 git hash: ${hash})`
}

function generateWebGL(
  platform: 'windows' | 'macos' | 'linux',
  random: () => number,
  profileSeed: string,
): WebGLConfig {
  // WEBGL_DATA_BY_PLATFORM always has 'windows' as fallback
  const platformData =
    WEBGL_DATA_BY_PLATFORM[platform] ?? WEBGL_DATA_BY_PLATFORM.windows
  const vendor = randomChoice(platformData?.vendors, random)
  const renderers = platformData?.renderers[vendor] ?? []
  const renderer =
    renderers.length > 0 ? randomChoice(renderers, random) : vendor

  return {
    vendor,
    renderer,
    unmaskedVendor: vendor,
    unmaskedRenderer: renderer,
    glVersion: buildAngleGlVersion(profileSeed),
    shadingLanguageVersion: 'OpenGL ES GLSL ES 1.00',
  }
}

function generateTimezone(
  region: 'us' | 'eu' | 'asia' | 'oceania' | undefined,
  geoLocation: GeoLocation | undefined,
  random: () => number,
): TimezoneConfig {
  // Priority 1: Use geoLocation timezone if available (most accurate)
  if (geoLocation?.timezone) {
    // Get dynamic offset that accounts for DST
    const dynamicOffset = getTimezoneOffsetDynamic(geoLocation.timezone)
    // Fall back to static lookup if dynamic fails
    const staticTz = TIMEZONES.find((tz) => tz.name === geoLocation.timezone)
    const offset = dynamicOffset ?? staticTz?.offset ?? 0
    return { name: geoLocation.timezone, offset }
  }

  // Priority 2: Use region-based selection
  if (region) {
    const regionPrefixes: Record<string, string[]> = {
      us: ['America/'],
      eu: ['Europe/'],
      asia: ['Asia/'],
      oceania: ['Australia/', 'Pacific/'],
    }
    const prefixes = regionPrefixes[region]
    if (prefixes) {
      const matching = TIMEZONES.filter((tz) =>
        prefixes.some((p) => tz.name.startsWith(p)),
      )
      if (matching.length > 0) {
        const tz = randomChoice(matching, random)
        return { name: tz.name, offset: tz.offset }
      }
    }
  }

  // Priority 3: Random selection from all timezones
  const tz = randomChoice(TIMEZONES, random)
  return { name: tz.name, offset: tz.offset }
}

function generateCanvas(profileId: string, random: () => number): CanvasConfig {
  // Use profile-specific seed for canvas noise
  const seed = stringToSeed(`canvas_${profileId}`)
  return {
    noiseSeed: seed,
    noiseLevel: 0.00001 + random() * 0.00009, // Small noise level
  }
}

function generateAudio(profileId: string, random: () => number): AudioConfig {
  // Use profile-specific seed for audio noise
  const seed = stringToSeed(`audio_${profileId}`)
  return {
    noiseSeed: seed,
    noiseLevel: 0.00001 + random() * 0.00009,
  }
}

function generateWebRTC(
  proxy: ProxyConfig | undefined,
  random: () => number,
): WebRTCConfig {
  // Generate random local IP
  const localIp = `192.168.${Math.floor(random() * 256)}.${Math.floor(random() * 254) + 1}`

  return {
    publicIp: null, // Will be determined by proxy
    localIp,
    disableWebRTC: !!proxy, // Disable WebRTC when using proxy to prevent IP leak
  }
}

function generateMediaDevices(
  profileId: string,
  platform: 'windows' | 'macos' | 'linux',
): MediaDevicesConfig {
  const templates = MEDIA_DEVICES[platform] ?? MEDIA_DEVICES.windows ?? []
  const devices = templates.map((device) => {
    const deviceId = hashToId(
      `${profileId}:${platform}:${device.kind}:${device.label}`,
    )
    const groupId = hashToId(`${profileId}:${platform}:${device.kind}:group`)
    return {
      kind: device.kind,
      deviceId,
      label: device.label,
      groupId,
    }
  })

  return { devices }
}

function generatePlugins(): PluginsConfig {
  const items = DEFAULT_PLUGINS.map((plugin) => ({
    name: plugin.name,
    description: plugin.description,
    filename: plugin.filename,
    mimeTypes: plugin.mimeTypes.map((mime) => ({
      type: mime.type,
      description: mime.description,
      suffixes: mime.suffixes,
    })),
  }))

  return { items }
}

function generateFonts(
  platform: 'windows' | 'macos' | 'linux',
  random: () => number,
): FontConfig {
  const platformFonts = FONTS[platform] ?? FONTS.windows ?? []
  const defaultFonts = DEFAULT_FONTS[platform] ?? DEFAULT_FONTS.windows ?? []
  const allKnownFonts = Array.from(
    new Set([
      ...platformFonts,
      ...(FONTS.windows ?? []),
      ...(FONTS.macos ?? []),
      ...(FONTS.linux ?? []),
      ...SAFE_UI_FONTS,
    ]),
  )

  // High-coverage baseline to avoid breaking UI text rendering in extensions/pages.
  const baseline = Array.from(
    new Set([...platformFonts, ...defaultFonts, ...SAFE_UI_FONTS]),
  )
  const mustKeepSet = new Set([...defaultFonts, ...SAFE_UI_FONTS])

  // Keep most fonts, but drop a few non-critical fonts per profile for variance.
  const removablePool = baseline.filter((font) => !mustKeepSet.has(font))
  const maxDrop = Math.min(removablePool.length, 6)
  const minDrop = maxDrop >= 2 ? 2 : 0
  const dropCount =
    minDrop +
    (maxDrop > minDrop ? Math.floor(random() * (maxDrop - minDrop + 1)) : 0)
  const droppedFonts = new Set(randomSample(removablePool, dropCount, random))

  // Also add a few cross-platform extras so profile sets are not identical.
  const baselineSet = new Set(baseline)
  const addablePool = allKnownFonts.filter((font) => !baselineSet.has(font))
  const addCount = Math.min(addablePool.length, Math.floor(random() * 3) + 1)
  const addedFonts = randomSample(addablePool, addCount, random)

  const selectedFonts = baseline
    .filter((font) => !droppedFonts.has(font))
    .concat(addedFonts)

  return {
    enabledFonts: selectedFonts,
    blockFontEnumeration: true,
  }
}

function generateClientRects(
  profileId: string,
  random: () => number,
): ClientRectsConfig {
  const seed = stringToSeed(`clientrects_${profileId}`)
  return {
    noiseSeed: seed,
    noiseLevel: 0.0005 + random() * 0.001,
  }
}

function generateBattery(): BatteryConfig {
  return {
    charging: true,
    chargingTime: 0,
    dischargingTime: Infinity,
    level: 1.0,
  }
}

function generateGeolocation(
  geoLocation: GeoLocation | undefined,
  targetRegion: 'us' | 'eu' | 'asia' | 'oceania' | undefined,
  random: () => number,
): GeolocationConfig {
  if (geoLocation?.latitude && geoLocation?.longitude) {
    return {
      enabled: true,
      latitude: geoLocation.latitude,
      longitude: geoLocation.longitude,
      accuracy: 20 + random() * 80,
    }
  }

  const regionPrefixes: Record<string, string[]> = {
    us: ['America/'],
    eu: ['Europe/'],
    asia: ['Asia/'],
    oceania: ['Australia/', 'Pacific/'],
  }

  let candidates = CITY_COORDINATES
  if (targetRegion) {
    const prefixes = regionPrefixes[targetRegion]
    if (prefixes) {
      const filtered = CITY_COORDINATES.filter((c) =>
        prefixes.some((p) => c.timezone.startsWith(p)),
      )
      if (filtered.length > 0) candidates = filtered
    }
  }

  const city = randomChoice(candidates, random)
  return {
    enabled: false,
    latitude: city.latitude + (random() - 0.5) * 0.02,
    longitude: city.longitude + (random() - 0.5) * 0.02,
    accuracy: 20 + random() * 80,
  }
}

function generateSpeechSynthesis(
  platform: 'windows' | 'macos' | 'linux',
  _random: () => number,
): SpeechSynthesisConfig {
  const voices =
    SPEECH_VOICES_BY_PLATFORM[platform] ??
    SPEECH_VOICES_BY_PLATFORM.windows ??
    []
  const selectedVoices = voices.map((v, i) => ({
    name: v.name,
    lang: v.lang,
    localService: v.localService,
    default: i === 0,
  }))
  return { voices: selectedVoices }
}

/**
 * Quick static method to generate a fingerprint with default settings
 */
export function generateQuickFingerprint(
  profileId: string,
  proxy?: ProxyConfig,
): FingerprintConfig {
  return generateFingerprint({ profileId, proxy })
}
