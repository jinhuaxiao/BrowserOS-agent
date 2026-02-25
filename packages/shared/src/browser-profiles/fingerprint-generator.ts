/**
 * Fingerprint Generator
 *
 * Generates realistic and consistent browser fingerprints for profiles.
 */

import { createHash } from 'crypto';
import type {
  FingerprintConfig,
  NavigatorConfig,
  ScreenConfig,
  WebGLConfig,
  TimezoneConfig,
  CanvasConfig,
  AudioConfig,
  WebRTCConfig,
  MediaDevicesConfig,
  PluginsConfig,
  FontConfig,
  ProxyConfig,
  GeoLocation,
} from './types.ts';
import {
  USER_AGENTS,
  WEBGL_DATA_BY_PLATFORM,
  SCREEN_RESOLUTIONS,
  TIMEZONES,
  LANGUAGES,
  FONTS,
  DEFAULT_FONTS,
  MEDIA_DEVICES,
  DEFAULT_PLUGINS,
  HARDWARE_CONCURRENCY,
  COUNTRY_LANGUAGES,
} from './fingerprint-data.ts';
import { getTimezoneOffsetDynamic } from './geolocation-service.ts';
import {
  generateUserAgentFromVersion,
  type UserAgentInfo,
} from './browser-version.ts';

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
];

/**
 * Simple seeded random number generator (Mulberry32)
 */
function createSeededRandom(seed: number): () => number {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Get a seed from a string
 */
function stringToSeed(str: string): number {
  const hash = createHash('md5').update(str).digest('hex');
  return parseInt(hash.slice(0, 8), 16);
}

function hashToId(value: string): string {
  return createHash('md5').update(value).digest('hex').slice(0, 16);
}

/**
 * Random choice from array using seeded random
 */
function randomChoice<T>(array: T[], random: () => number): T {
  const index = Math.floor(random() * array.length);
  return array[index] as T;
}

/**
 * Random sample from array using seeded random
 */
function randomSample<T>(array: T[], count: number, random: () => number): T[] {
  const shuffled = [...array].sort(() => random() - 0.5);
  return shuffled.slice(0, Math.min(count, array.length));
}

export interface GeneratorOptions {
  profileId: string;
  targetPlatform?: 'windows' | 'macos' | 'linux';
  targetRegion?: 'us' | 'eu' | 'asia' | 'oceania';
  proxy?: ProxyConfig;
  seed?: number;
  /**
   * Geolocation information from proxy IP detection.
   * If provided, timezone and language will be matched to this location
   * (takes priority over targetRegion).
   */
  geoLocation?: GeoLocation;
  /**
   * Chrome browser version string (e.g., "142.0.6367.91").
   * If provided, User Agent will be dynamically generated to match this version.
   * This prevents fingerprint detection sites from flagging version mismatches
   * between the User Agent string and the actual browser version detected via JS APIs.
   */
  chromeVersion?: string;
}

/**
 * Generate a complete fingerprint configuration
 */
export function generateFingerprint(options: GeneratorOptions): FingerprintConfig {
  const {
    profileId,
    targetPlatform = 'windows',
    targetRegion,
    proxy,
    geoLocation,
    chromeVersion,
  } = options;

  // Create deterministic random from profile ID
  const seed = options.seed ?? stringToSeed(profileId);
  const random = createSeededRandom(seed);

  const navigator = generateNavigator(targetPlatform, geoLocation, random, chromeVersion);
  const screen = generateScreen(random);
  const webgl = generateWebGL(targetPlatform, random);
  const timezone = generateTimezone(targetRegion, geoLocation, random);
  const canvas = generateCanvas(profileId, random);
  const audio = generateAudio(profileId, random);
  const webrtc = generateWebRTC(proxy, random);
  const mediaDevices = generateMediaDevices(profileId, targetPlatform);
  const plugins = generatePlugins();
  const fonts = generateFonts(targetPlatform, random);

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
    tlsProfile: 'chrome',
    proxy,
  };
}

/**
 * Generate Accept-Language header from languages array
 * Format: "en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7"
 */
function generateAcceptLanguage(languages: string[]): string {
  if (languages.length === 0) {
    return 'en-US,en;q=0.9';
  }

  return languages
    .map((lang, index) => {
      if (index === 0) {
        return lang; // First language has implicit q=1.0
      }
      // Decrease quality value for each subsequent language
      const q = Math.max(0.1, 1 - index * 0.1).toFixed(1);
      return `${lang};q=${q}`;
    })
    .join(',');
}

function generateNavigator(
  platform: 'windows' | 'macos' | 'linux',
  geoLocation: GeoLocation | undefined,
  random: () => number,
  chromeVersion?: string
): NavigatorConfig {
  // Map platform to user agent platform string
  const platformMapping: Record<string, string> = {
    windows: 'Win32',
    macos: 'MacIntel',
    linux: 'Linux x86_64',
  };
  const targetPlatformStr = platformMapping[platform];

  // Try to generate User Agent dynamically from Chrome version
  // This ensures the UA string matches the actual browser version
  let ua: UserAgentInfo | null = null;
  if (chromeVersion) {
    ua = generateUserAgentFromVersion(chromeVersion, platform);
  }

  // Fall back to static USER_AGENTS pool if dynamic generation fails
  if (!ua) {
    // Filter user agents by platform
    const matchingAgents = USER_AGENTS.filter((agent) => agent.platform === targetPlatformStr);
    const agentPool = matchingAgents.length > 0 ? matchingAgents : USER_AGENTS;
    ua = randomChoice(agentPool, random);
  }

  // Select language - prefer geolocation-based language if available
  let lang: { language: string; languages: string[] };
  if (geoLocation?.country) {
    const countryLang = COUNTRY_LANGUAGES[geoLocation.country.toUpperCase()];
    lang = countryLang || randomChoice(LANGUAGES, random);
  } else {
    lang = randomChoice(LANGUAGES, random);
  }

  // Generate Accept-Language header to match JS API
  const acceptLanguage = generateAcceptLanguage(lang.languages);

  // Correlate CPU cores and device memory for realistic hardware combinations
  const cores = randomChoice(HARDWARE_CONCURRENCY, random);
  const memoryOptions: number[] = cores <= 4 ? [4, 8, 16] : cores <= 8 ? [8, 16, 32] : [16, 32];
  const memory = randomChoice(memoryOptions, random);

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
  };
}

function generateScreen(random: () => number): ScreenConfig {
  const resolution = randomChoice(SCREEN_RESOLUTIONS, random);
  const dpr = randomChoice([1.0, 1.25, 1.5, 2.0], random);

  return {
    width: resolution.width,
    height: resolution.height,
    availWidth: resolution.width,
    availHeight: resolution.availHeight,
    colorDepth: 24,
    pixelDepth: 24,
    devicePixelRatio: dpr,
  };
}

function generateWebGL(platform: 'windows' | 'macos' | 'linux', random: () => number): WebGLConfig {
  // WEBGL_DATA_BY_PLATFORM always has 'windows' as fallback
  const platformData = WEBGL_DATA_BY_PLATFORM[platform] ?? WEBGL_DATA_BY_PLATFORM['windows']!;
  const vendor = randomChoice(platformData!.vendors, random);
  const renderers = platformData!.renderers[vendor] ?? [];
  const renderer = renderers.length > 0 ? randomChoice(renderers, random) : vendor;

  return {
    vendor,
    renderer,
    unmaskedVendor: vendor,
    unmaskedRenderer: renderer,
  };
}

function generateTimezone(
  region: 'us' | 'eu' | 'asia' | 'oceania' | undefined,
  geoLocation: GeoLocation | undefined,
  random: () => number
): TimezoneConfig {
  // Priority 1: Use geoLocation timezone if available (most accurate)
  if (geoLocation?.timezone) {
    // Get dynamic offset that accounts for DST
    const dynamicOffset = getTimezoneOffsetDynamic(geoLocation.timezone);
    // Fall back to static lookup if dynamic fails
    const staticTz = TIMEZONES.find((tz) => tz.name === geoLocation.timezone);
    const offset = dynamicOffset ?? staticTz?.offset ?? 0;
    return { name: geoLocation.timezone, offset };
  }

  // Priority 2: Use region-based selection
  if (region) {
    const regionPrefixes: Record<string, string[]> = {
      us: ['America/'],
      eu: ['Europe/'],
      asia: ['Asia/'],
      oceania: ['Australia/', 'Pacific/'],
    };
    const prefixes = regionPrefixes[region];
    if (prefixes) {
      const matching = TIMEZONES.filter((tz) => prefixes.some((p) => tz.name.startsWith(p)));
      if (matching.length > 0) {
        const tz = randomChoice(matching, random);
        return { name: tz.name, offset: tz.offset };
      }
    }
  }

  // Priority 3: Random selection from all timezones
  const tz = randomChoice(TIMEZONES, random);
  return { name: tz.name, offset: tz.offset };
}

function generateCanvas(profileId: string, random: () => number): CanvasConfig {
  // Use profile-specific seed for canvas noise
  const seed = stringToSeed(`canvas_${profileId}`);
  return {
    noiseSeed: seed,
    noiseLevel: 0.00001 + random() * 0.00009, // Small noise level
  };
}

function generateAudio(profileId: string, random: () => number): AudioConfig {
  // Use profile-specific seed for audio noise
  const seed = stringToSeed(`audio_${profileId}`);
  return {
    noiseSeed: seed,
    noiseLevel: 0.00001 + random() * 0.00009,
  };
}

function generateWebRTC(proxy: ProxyConfig | undefined, random: () => number): WebRTCConfig {
  // Generate random local IP
  const localIp = `192.168.${Math.floor(random() * 256)}.${Math.floor(random() * 254) + 1}`;

  return {
    publicIp: null, // Will be determined by proxy
    localIp,
    disableWebRTC: !!proxy, // Disable WebRTC when using proxy to prevent IP leak
  };
}

function generateMediaDevices(
  profileId: string,
  platform: 'windows' | 'macos' | 'linux'
): MediaDevicesConfig {
  const templates = MEDIA_DEVICES[platform] ?? MEDIA_DEVICES.windows ?? [];
  const devices = templates.map((device) => {
    const deviceId = hashToId(`${profileId}:${platform}:${device.kind}:${device.label}`);
    const groupId = hashToId(`${profileId}:${platform}:${device.kind}:group`);
    return {
      kind: device.kind,
      deviceId,
      label: device.label,
      groupId,
    };
  });

  return { devices };
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
  }));

  return { items };
}

function generateFonts(
  platform: 'windows' | 'macos' | 'linux',
  random: () => number
): FontConfig {
  const platformFonts = FONTS[platform] ?? FONTS.windows ?? [];
  const defaultFonts = DEFAULT_FONTS[platform] ?? DEFAULT_FONTS.windows ?? [];
  const allKnownFonts = Array.from(
    new Set([
      ...platformFonts,
      ...(FONTS.windows ?? []),
      ...(FONTS.macos ?? []),
      ...(FONTS.linux ?? []),
      ...SAFE_UI_FONTS,
    ])
  );

  // High-coverage baseline to avoid breaking UI text rendering in extensions/pages.
  const baseline = Array.from(new Set([...platformFonts, ...defaultFonts, ...SAFE_UI_FONTS]));
  const mustKeepSet = new Set([...defaultFonts, ...SAFE_UI_FONTS]);

  // Keep most fonts, but drop a few non-critical fonts per profile for variance.
  const removablePool = baseline.filter((font) => !mustKeepSet.has(font));
  const maxDrop = Math.min(removablePool.length, 6);
  const minDrop = maxDrop >= 2 ? 2 : 0;
  const dropCount = minDrop + (maxDrop > minDrop ? Math.floor(random() * (maxDrop - minDrop + 1)) : 0);
  const droppedFonts = new Set(randomSample(removablePool, dropCount, random));

  // Also add a few cross-platform extras so profile sets are not identical.
  const baselineSet = new Set(baseline);
  const addablePool = allKnownFonts.filter((font) => !baselineSet.has(font));
  const addCount = Math.min(addablePool.length, Math.floor(random() * 3) + 1);
  const addedFonts = randomSample(addablePool, addCount, random);

  const selectedFonts = baseline
    .filter((font) => !droppedFonts.has(font))
    .concat(addedFonts);

  return {
    enabledFonts: selectedFonts,
    blockFontEnumeration: true,
  };
}

/**
 * Quick static method to generate a fingerprint with default settings
 */
export function generateQuickFingerprint(
  profileId: string,
  proxy?: ProxyConfig
): FingerprintConfig {
  return generateFingerprint({ profileId, proxy });
}
