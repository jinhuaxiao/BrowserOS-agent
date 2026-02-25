/**
 * Profile Migration Utilities
 *
 * Handles migration of existing profiles to use the proxy pool system.
 */

import type { BrowserProfileConfig, SavedProxy, ProxyConfig } from './types.ts';
import { listProfiles, saveProfileConfig } from './storage.ts';
import { createProxy, listProxies } from './proxy-storage.ts';

/**
 * Result of migration operation
 */
export interface MigrationResult {
  migratedProfiles: number;
  uniqueProxies: number;
  skippedProfiles: number;
  errors: Array<{ profileId: string; error: string }>;
}

/**
 * Create a SavedProxy from a legacy embedded ProxyConfig
 */
function createProxyFromLegacy(
  proxy: ProxyConfig,
  profileName: string
): SavedProxy {
  return createProxy({
    name: `${profileName} Proxy (${proxy.host}:${proxy.port})`,
    type: proxy.type,
    host: proxy.host,
    port: proxy.port,
    username: proxy.username,
    password: proxy.password,
  });
}

/**
 * Generate a unique key for a proxy configuration
 */
function getProxyKey(proxy: ProxyConfig): string {
  return `${proxy.type}://${proxy.host}:${proxy.port}`;
}

/**
 * Migrate existing profiles with embedded proxies to use the proxy pool
 *
 * This function:
 * 1. Scans all profiles for embedded proxy configurations
 * 2. Creates unique proxies in the proxy pool (avoiding duplicates)
 * 3. Updates profiles to use proxyId instead of embedded proxy
 * 4. Preserves the original proxy field for backward compatibility
 */
export function migrateToProxyPool(): MigrationResult {
  const result: MigrationResult = {
    migratedProfiles: 0,
    uniqueProxies: 0,
    skippedProfiles: 0,
    errors: [],
  };

  const profiles = listProfiles();
  const existingProxies = listProxies();

  // Map of proxy key -> proxyId for deduplication
  const proxyMap = new Map<string, string>();

  // First, index existing proxies
  for (const proxy of existingProxies) {
    const key = `${proxy.type}://${proxy.host}:${proxy.port}`;
    proxyMap.set(key, proxy.id);
  }

  for (const profile of profiles) {
    try {
      // Skip profiles that already have a proxyId
      if (profile.proxyId) {
        result.skippedProfiles++;
        continue;
      }

      // Skip profiles without embedded proxy
      if (!profile.proxy) {
        result.skippedProfiles++;
        continue;
      }

      const proxyKey = getProxyKey(profile.proxy);

      // Check if this proxy already exists in the pool
      let proxyId = proxyMap.get(proxyKey);

      if (!proxyId) {
        // Create new proxy in the pool
        const savedProxy = createProxyFromLegacy(profile.proxy, profile.name);
        proxyId = savedProxy.id;
        proxyMap.set(proxyKey, proxyId);
        result.uniqueProxies++;
      }

      // Update profile to use proxyId
      profile.proxyId = proxyId;
      profile.updatedAt = Date.now();

      // Note: We keep the proxy field for backward compatibility
      // It will be marked as deprecated in the types

      saveProfileConfig(profile);
      result.migratedProfiles++;
    } catch (error) {
      result.errors.push({
        profileId: profile.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return result;
}

/**
 * Check if migration is needed
 * Returns true if there are profiles with embedded proxies but no proxyId
 */
export function needsMigration(): boolean {
  const profiles = listProfiles();
  return profiles.some((p) => p.proxy && !p.proxyId);
}

/**
 * Get migration preview without making changes
 */
export function getMigrationPreview(): {
  profilesToMigrate: number;
  uniqueProxies: number;
  profilesWithProxy: Array<{ profileId: string; profileName: string; proxyKey: string }>;
} {
  const profiles = listProfiles();
  const existingProxies = listProxies();
  const proxyKeys = new Set<string>();

  // Index existing proxies
  for (const proxy of existingProxies) {
    proxyKeys.add(`${proxy.type}://${proxy.host}:${proxy.port}`);
  }

  const profilesWithProxy: Array<{ profileId: string; profileName: string; proxyKey: string }> = [];
  const newProxyKeys = new Set<string>();

  for (const profile of profiles) {
    if (profile.proxy && !profile.proxyId) {
      const proxyKey = getProxyKey(profile.proxy);
      profilesWithProxy.push({
        profileId: profile.id,
        profileName: profile.name,
        proxyKey,
      });

      if (!proxyKeys.has(proxyKey)) {
        newProxyKeys.add(proxyKey);
      }
    }
  }

  return {
    profilesToMigrate: profilesWithProxy.length,
    uniqueProxies: newProxyKeys.size,
    profilesWithProxy,
  };
}

/**
 * Rollback migration - remove proxyId from profiles
 * This is useful for testing or if something goes wrong
 */
export function rollbackMigration(): number {
  const profiles = listProfiles();
  let rolledBack = 0;

  for (const profile of profiles) {
    if (profile.proxyId && profile.proxy) {
      profile.proxyId = undefined;
      profile.updatedAt = Date.now();
      saveProfileConfig(profile);
      rolledBack++;
    }
  }

  return rolledBack;
}

/**
 * Clean up legacy proxy fields after confirming migration success
 * This removes the deprecated proxy field from profiles that have proxyId
 */
export function cleanupLegacyProxyFields(): number {
  const profiles = listProfiles();
  let cleaned = 0;

  for (const profile of profiles) {
    if (profile.proxyId && profile.proxy) {
      // Remove the legacy proxy field
      delete profile.proxy;
      profile.updatedAt = Date.now();
      saveProfileConfig(profile);
      cleaned++;
    }
  }

  return cleaned;
}
