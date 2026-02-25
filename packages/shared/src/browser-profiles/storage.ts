/**
 * Browser Profile Storage
 *
 * CRUD operations for browser profiles.
 * Profiles are stored at ~/.craft-agent/browser-profiles/{profileId}/
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, rmSync } from 'fs';
import { join, basename } from 'path';
import { randomUUID } from 'crypto';
import { homedir } from 'os';
import type {
  BrowserProfileConfig,
  CreateProfileInput,
  UpdateProfileInput,
  FingerprintConfig,
  GeoLocation,
} from './types.ts';
import { generateFingerprint } from './fingerprint-generator.ts';
import { getProxy } from './proxy-storage.ts';
import { detectBrowserVersion } from './browser-version.ts';
import { findBrowserExecutable } from './launcher.ts';
import { buildFingerprintExtension } from './extension-builder.ts';
import { calculatePortFromProfileId } from './mcp-port-discovery.ts';

// Base directory for browser profiles
const BROWSER_PROFILES_DIR = join(homedir(), '.craft-agent', 'browser-profiles');

/**
 * Ensure browser profiles directory exists
 */
export function ensureProfilesDir(): void {
  if (!existsSync(BROWSER_PROFILES_DIR)) {
    mkdirSync(BROWSER_PROFILES_DIR, { recursive: true });
  }
}

/**
 * Get path to a profile directory
 */
export function getProfilePath(profileId: string): string {
  return join(BROWSER_PROFILES_DIR, profileId);
}

/**
 * Get path to profile config file
 */
export function getProfileConfigPath(profileId: string): string {
  return join(getProfilePath(profileId), 'config.json');
}

/**
 * Get path to fingerprint config file (used by browser)
 */
export function getFingerprintConfigPath(profileId: string): string {
  return join(getProfilePath(profileId), 'fingerprint.json');
}

/**
 * Get path to user data directory (browser profile data)
 */
export function getUserDataDir(profileId: string): string {
  return join(getProfilePath(profileId), 'user-data');
}

/**
 * Load a profile config
 */
export function loadProfileConfig(profileId: string): BrowserProfileConfig | null {
  const configPath = getProfileConfigPath(profileId);
  if (!existsSync(configPath)) return null;

  try {
    return JSON.parse(readFileSync(configPath, 'utf-8')) as BrowserProfileConfig;
  } catch {
    return null;
  }
}

/**
 * Save a profile config
 */
export function saveProfileConfig(profile: BrowserProfileConfig): void {
  const profileDir = getProfilePath(profile.id);
  if (!existsSync(profileDir)) {
    mkdirSync(profileDir, { recursive: true });
  }

  // Save profile config
  const configPath = getProfileConfigPath(profile.id);
  writeFileSync(configPath, JSON.stringify(profile, null, 2));

  // Save fingerprint config separately for browser use
  const fingerprintPath = getFingerprintConfigPath(profile.id);
  writeFileSync(fingerprintPath, JSON.stringify(profile.fingerprint, null, 2));

  // Build fingerprint extension if not exists (for backward compatibility)
  // This ensures existing profiles get the extension on next save
  buildFingerprintExtension(profile.fingerprint, profileDir).catch(() => {
    // Ignore errors - extension building is best-effort for existing profiles
  });
}

/**
 * Generate URL-safe slug from name
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 30);
}

/**
 * Create a new browser profile
 */
export async function createProfile(input: CreateProfileInput): Promise<BrowserProfileConfig> {
  ensureProfilesDir();

  const profileId = `${generateSlug(input.name)}_${randomUUID().slice(0, 8)}`;
  const now = Date.now();

  // Get geolocation from proxy pool if proxyId is provided
  // This allows fingerprint timezone/language to match the proxy location
  let geoLocation: GeoLocation | undefined;
  if (input.proxyId) {
    const savedProxy = getProxy(input.proxyId);
    if (savedProxy?.geoLocation) {
      geoLocation = savedProxy.geoLocation;
    }
  }

  // Detect browser version to generate matching User Agent
  // This prevents fingerprint detection sites from flagging version mismatches
  let chromeVersion: string | undefined;
  const browserPath = findBrowserExecutable();
  if (browserPath) {
    const versionInfo = await detectBrowserVersion(browserPath);
    if (versionInfo) {
      chromeVersion = versionInfo.fullVersion;
    }
  }

  // Generate fingerprint
  let fingerprint: FingerprintConfig;
  if (input.fingerprint && Object.keys(input.fingerprint).length > 0) {
    // Merge with generated defaults
    const generated = generateFingerprint({
      profileId,
      targetPlatform: input.targetPlatform,
      targetRegion: input.targetRegion,
      proxy: input.proxy,
      geoLocation,
      chromeVersion,
    });
    fingerprint = { ...generated, ...input.fingerprint, profileId };
  } else {
    fingerprint = generateFingerprint({
      profileId,
      targetPlatform: input.targetPlatform,
      targetRegion: input.targetRegion,
      proxy: input.proxy,
      geoLocation,
      chromeVersion,
    });
  }

  // Create user data directory
  const userDataDir = getUserDataDir(profileId);
  mkdirSync(userDataDir, { recursive: true });

  // Pre-allocate MCP port based on profileId (deterministic allocation)
  // This allows knowing the MCP port before launching the browser
  const mcpPort = calculatePortFromProfileId(profileId);

  const profile: BrowserProfileConfig = {
    id: profileId,
    name: input.name,
    description: input.description,
    platform: input.platform,
    fingerprint,
    proxy: input.proxy,
    proxyId: input.proxyId,
    groupId: input.groupId,
    startupUrl: input.startupUrl,
    userDataDir,
    // MCP configuration with pre-allocated port
    mcp: {
      transport: 'http',
      port: mcpPort,
      host: '127.0.0.1',
    },
    status: 'idle',
    tags: input.tags,
    createdAt: now,
    updatedAt: now,
  };

  saveProfileConfig(profile);

  // Build fingerprint injection extension for this profile
  // This extension will override browser APIs to match the fingerprint
  const profileDir = getProfilePath(profileId);
  await buildFingerprintExtension(fingerprint, profileDir);

  return profile;
}

/**
 * Update a browser profile
 */
export function updateProfile(
  profileId: string,
  input: UpdateProfileInput
): BrowserProfileConfig | null {
  const profile = loadProfileConfig(profileId);
  if (!profile) return null;

  // Update basic fields
  if (input.name !== undefined) profile.name = input.name;
  if (input.description !== undefined) profile.description = input.description;
  if (input.platform !== undefined) profile.platform = input.platform;
  if (input.proxy !== undefined) profile.proxy = input.proxy;
  if (input.proxyId !== undefined) profile.proxyId = input.proxyId;
  if (input.groupId !== undefined) profile.groupId = input.groupId;
  if (input.startupUrl !== undefined) profile.startupUrl = input.startupUrl;
  if (input.tags !== undefined) profile.tags = input.tags;

  // Update fingerprint if provided
  if (input.fingerprint) {
    profile.fingerprint = { ...profile.fingerprint, ...input.fingerprint };
    // Also update proxy in fingerprint if changed
    if (input.proxy !== undefined) {
      profile.fingerprint.proxy = input.proxy;
    }
  }

  profile.updatedAt = Date.now();
  saveProfileConfig(profile);
  return profile;
}

/**
 * Delete a browser profile
 */
export function deleteProfile(profileId: string): boolean {
  const profileDir = getProfilePath(profileId);
  if (!existsSync(profileDir)) return false;

  rmSync(profileDir, { recursive: true });
  return true;
}

/**
 * Get a browser profile by ID
 */
export function getProfile(profileId: string): BrowserProfileConfig | null {
  return loadProfileConfig(profileId);
}

/**
 * Reserved directory names that are not browser profiles
 */
const RESERVED_DIRS = new Set(['groups', 'proxies', 'templates']);

/**
 * List all browser profiles
 */
export function listProfiles(): BrowserProfileConfig[] {
  ensureProfilesDir();

  const profiles: BrowserProfileConfig[] = [];
  const entries = readdirSync(BROWSER_PROFILES_DIR, { withFileTypes: true });

  for (const entry of entries) {
    // Skip reserved directories (groups, proxies, templates)
    if (entry.isDirectory() && !RESERVED_DIRS.has(entry.name)) {
      const profile = loadProfileConfig(entry.name);
      // Validate that it's a proper profile (has fingerprint)
      if (profile && profile.fingerprint && typeof profile.id === 'string') {
        profiles.push(profile);
      }
    }
  }

  // Sort by creation date (newest first)
  return profiles.sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Update profile status
 */
export function updateProfileStatus(
  profileId: string,
  status: 'idle' | 'running' | 'error',
  options?: { pid?: number; error?: string }
): BrowserProfileConfig | null {
  const profile = loadProfileConfig(profileId);
  if (!profile) return null;

  profile.status = status;
  profile.updatedAt = Date.now();

  if (status === 'running' && options?.pid) {
    profile.pid = options.pid;
    profile.lastLaunchedAt = Date.now();
    profile.lastError = undefined;
  } else if (status === 'idle') {
    profile.pid = undefined;
  } else if (status === 'error' && options?.error) {
    profile.lastError = options.error;
    profile.pid = undefined;
  }

  saveProfileConfig(profile);
  return profile;
}

/**
 * Regenerate fingerprint for a profile
 */
export async function regenerateFingerprint(
  profileId: string,
  options?: {
    targetPlatform?: 'windows' | 'macos' | 'linux';
    targetRegion?: 'us' | 'eu' | 'asia' | 'oceania';
  }
): Promise<BrowserProfileConfig | null> {
  const profile = loadProfileConfig(profileId);
  if (!profile) return null;

  // Get geolocation from proxy pool if proxyId is set
  let geoLocation: GeoLocation | undefined;
  if (profile.proxyId) {
    const savedProxy = getProxy(profile.proxyId);
    if (savedProxy?.geoLocation) {
      geoLocation = savedProxy.geoLocation;
    }
  }

  // Detect browser version to generate matching User Agent
  let chromeVersion: string | undefined;
  const browserPath = findBrowserExecutable();
  if (browserPath) {
    const versionInfo = await detectBrowserVersion(browserPath);
    if (versionInfo) {
      chromeVersion = versionInfo.fullVersion;
    }
  }

  // Generate new fingerprint with new random seed
  profile.fingerprint = generateFingerprint({
    profileId,
    targetPlatform: options?.targetPlatform,
    targetRegion: options?.targetRegion,
    proxy: profile.proxy,
    geoLocation,
    chromeVersion,
    seed: Date.now(), // Use current time as seed for new random values
  });

  profile.updatedAt = Date.now();
  saveProfileConfig(profile);

  // Rebuild fingerprint injection extension with new fingerprint
  const profileDir = getProfilePath(profileId);
  await buildFingerprintExtension(profile.fingerprint, profileDir);

  return profile;
}

/**
 * Get profiles base directory
 */
export function getProfilesBaseDir(): string {
  return BROWSER_PROFILES_DIR;
}

/**
 * Rebuild fingerprint extension for a single profile
 * Useful for updating existing profiles to use the extension
 */
export async function rebuildProfileExtension(profileId: string): Promise<boolean> {
  const profile = loadProfileConfig(profileId);
  if (!profile) return false;

  const profileDir = getProfilePath(profileId);
  await buildFingerprintExtension(profile.fingerprint, profileDir);
  return true;
}

/**
 * Rebuild fingerprint extensions for all profiles
 * Useful for migration when updating to the extension-based approach
 */
export async function rebuildAllProfileExtensions(): Promise<{
  success: number;
  failed: number;
  errors: Array<{ profileId: string; error: string }>;
}> {
  const profiles = listProfiles();
  const result = {
    success: 0,
    failed: 0,
    errors: [] as Array<{ profileId: string; error: string }>,
  };

  for (const profile of profiles) {
    try {
      const profileDir = getProfilePath(profile.id);
      await buildFingerprintExtension(profile.fingerprint, profileDir);
      result.success++;
    } catch (err) {
      result.failed++;
      result.errors.push({
        profileId: profile.id,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  return result;
}
