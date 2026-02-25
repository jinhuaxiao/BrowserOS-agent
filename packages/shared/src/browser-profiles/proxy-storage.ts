/**
 * Proxy Pool Storage
 *
 * CRUD operations for the proxy pool.
 * Proxies are stored at ~/.craft-agent/browser-profiles/proxies/pool.json
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { homedir } from 'os';
import * as net from 'net';
import type {
  SavedProxy,
  CreateProxyInput,
  UpdateProxyInput,
  ProxyStatus,
  ProxyHealthResult,
  ProxyImportResult,
  GeoLocation,
} from './types.ts';
import { listProfiles } from './storage.ts';
import { detectProxyGeoLocation } from './geolocation-service.ts';

// Proxy pool storage location
const PROXY_POOL_DIR = join(homedir(), '.craft-agent', 'browser-profiles', 'proxies');
const PROXY_POOL_FILE = join(PROXY_POOL_DIR, 'pool.json');

/**
 * Ensure proxy pool directory exists
 */
function ensureProxyPoolDir(): void {
  if (!existsSync(PROXY_POOL_DIR)) {
    mkdirSync(PROXY_POOL_DIR, { recursive: true });
  }
}

/**
 * Load proxy pool from disk
 */
function loadProxyPool(): SavedProxy[] {
  ensureProxyPoolDir();

  if (!existsSync(PROXY_POOL_FILE)) {
    return [];
  }

  try {
    return JSON.parse(readFileSync(PROXY_POOL_FILE, 'utf-8')) as SavedProxy[];
  } catch {
    return [];
  }
}

/**
 * Save proxy pool to disk
 */
function saveProxyPool(proxies: SavedProxy[]): void {
  ensureProxyPoolDir();
  writeFileSync(PROXY_POOL_FILE, JSON.stringify(proxies, null, 2));
}

/**
 * List all proxies in the pool
 */
export function listProxies(): SavedProxy[] {
  return loadProxyPool();
}

/**
 * Get a proxy by ID
 */
export function getProxy(proxyId: string): SavedProxy | null {
  const proxies = loadProxyPool();
  return proxies.find((p) => p.id === proxyId) || null;
}

/**
 * Create a new proxy in the pool
 */
export function createProxy(input: CreateProxyInput): SavedProxy {
  const proxies = loadProxyPool();
  const now = Date.now();

  const proxy: SavedProxy = {
    id: randomUUID(),
    name: input.name,
    type: input.type,
    host: input.host,
    port: input.port,
    username: input.username,
    password: input.password,
    status: 'unknown',
    profileCount: 0,
    tags: input.tags,
    region: input.region,
    provider: input.provider,
    createdAt: now,
    updatedAt: now,
  };

  proxies.push(proxy);
  saveProxyPool(proxies);

  return proxy;
}

/**
 * Update a proxy in the pool
 */
export function updateProxy(proxyId: string, input: UpdateProxyInput): SavedProxy | null {
  const proxies = loadProxyPool();
  const index = proxies.findIndex((p) => p.id === proxyId);
  if (index === -1) return null;

  const proxy = proxies[index]!;

  if (input.name !== undefined) proxy.name = input.name;
  if (input.type !== undefined) proxy.type = input.type;
  if (input.host !== undefined) proxy.host = input.host;
  if (input.port !== undefined) proxy.port = input.port;
  if (input.username !== undefined) proxy.username = input.username;
  if (input.password !== undefined) proxy.password = input.password;
  if (input.tags !== undefined) proxy.tags = input.tags;
  if (input.region !== undefined) proxy.region = input.region;
  if (input.provider !== undefined) proxy.provider = input.provider;

  proxy.updatedAt = Date.now();
  // Reset status when connection details change
  if (input.host !== undefined || input.port !== undefined) {
    proxy.status = 'unknown';
  }

  proxies[index] = proxy;
  saveProxyPool(proxies);

  return proxy;
}

/**
 * Delete a proxy from the pool
 */
export function deleteProxy(proxyId: string): boolean {
  const proxies = loadProxyPool();
  const index = proxies.findIndex((p) => p.id === proxyId);
  if (index === -1) return false;

  proxies.splice(index, 1);
  saveProxyPool(proxies);

  return true;
}

/**
 * Get profiles using a specific proxy
 */
export function getProfilesUsingProxy(proxyId: string): string[] {
  const profiles = listProfiles();
  return profiles.filter((p) => p.proxyId === proxyId).map((p) => p.id);
}

/**
 * Update the profile count for a proxy
 */
export function updateProxyProfileCount(proxyId: string): void {
  const proxies = loadProxyPool();
  const proxy = proxies.find((p) => p.id === proxyId);
  if (!proxy) return;

  proxy.profileCount = getProfilesUsingProxy(proxyId).length;
  saveProxyPool(proxies);
}

/**
 * Update profile counts for all proxies
 */
export function updateAllProxyProfileCounts(): void {
  const proxies = loadProxyPool();
  const profiles = listProfiles();

  for (const proxy of proxies) {
    proxy.profileCount = profiles.filter((p) => p.proxyId === proxy.id).length;
  }

  saveProxyPool(proxies);
}

/**
 * Parse proxy string in format: host:port[:username:password]
 * Also supports: type://host:port[:username:password]
 */
function parseProxyString(
  line: string
): { type: 'socks5' | 'http' | 'https'; host: string; port: number; username?: string; password?: string } | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;

  let type: 'socks5' | 'http' | 'https' = 'socks5';
  let rest = trimmed;

  // Check for protocol prefix
  if (trimmed.startsWith('socks5://')) {
    type = 'socks5';
    rest = trimmed.slice(9);
  } else if (trimmed.startsWith('http://')) {
    type = 'http';
    rest = trimmed.slice(7);
  } else if (trimmed.startsWith('https://')) {
    type = 'https';
    rest = trimmed.slice(8);
  }

  // Parse host:port:username:password
  const parts = rest.split(':');
  if (parts.length < 2) return null;

  const host = parts[0] || '';
  const port = parseInt(parts[1] || '', 10);

  if (!host || isNaN(port) || port < 1 || port > 65535) return null;

  const username = parts[2] || undefined;
  const password = parts[3] || undefined;

  return { type, host, port, username, password };
}

/**
 * Import proxies from text (one per line)
 * Format: host:port:username:password or type://host:port:username:password
 */
export function importProxies(
  lines: string[],
  options?: { defaultType?: 'socks5' | 'http' | 'https'; tags?: string[]; region?: string; provider?: string }
): ProxyImportResult {
  const result: ProxyImportResult = {
    total: lines.length,
    success: 0,
    failed: 0,
    errors: [],
    proxies: [],
  };

  const proxies = loadProxyPool();
  const now = Date.now();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] || '';
    const lineNum = i + 1;

    try {
      const parsed = parseProxyString(line);
      if (!parsed) {
        if (line.trim() && !line.trim().startsWith('#')) {
          result.failed++;
          result.errors.push({ line: lineNum, error: 'Invalid format' });
        }
        continue;
      }

      // Check for duplicate
      const exists = proxies.some(
        (p) => p.host === parsed.host && p.port === parsed.port && p.type === parsed.type
      );
      if (exists) {
        result.failed++;
        result.errors.push({ line: lineNum, error: 'Proxy already exists' });
        continue;
      }

      const proxy: SavedProxy = {
        id: randomUUID(),
        name: `${parsed.host}:${parsed.port}`,
        type: options?.defaultType || parsed.type,
        host: parsed.host,
        port: parsed.port,
        username: parsed.username,
        password: parsed.password,
        status: 'unknown',
        profileCount: 0,
        tags: options?.tags,
        region: options?.region as SavedProxy['region'],
        provider: options?.provider,
        createdAt: now,
        updatedAt: now,
      };

      proxies.push(proxy);
      result.proxies.push(proxy);
      result.success++;
    } catch (error) {
      result.failed++;
      result.errors.push({
        line: lineNum,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  if (result.success > 0) {
    saveProxyPool(proxies);
  }

  return result;
}

/**
 * Check proxy health by attempting a connection
 */
export async function checkProxyHealth(proxyId: string): Promise<ProxyHealthResult> {
  const proxies = loadProxyPool();
  const proxy = proxies.find((p) => p.id === proxyId);

  if (!proxy) {
    return {
      proxyId,
      status: 'unknown',
      errorMessage: 'Proxy not found',
      checkedAt: Date.now(),
    };
  }

  // Update status to checking
  proxy.status = 'checking';
  saveProxyPool(proxies);

  const result: ProxyHealthResult = {
    proxyId,
    status: 'unknown',
    checkedAt: Date.now(),
  };

  const startTime = Date.now();

  try {
    // Test connection by attempting to connect to the proxy server
    // This validates that the proxy is reachable, not that it forwards traffic correctly
    await new Promise<void>((resolve, reject) => {
      const socket = net.createConnection({ host: proxy.host, port: proxy.port }, () => {
        socket.destroy();
        resolve();
      });
      socket.setTimeout(10000);
      socket.on('timeout', () => {
        socket.destroy();
        reject(new Error('Connection timeout'));
      });
      socket.on('error', reject);
    });

    result.status = 'healthy';
    result.responseTimeMs = Date.now() - startTime;
  } catch (error) {
    result.status = 'unhealthy';
    result.errorMessage = error instanceof Error ? error.message : 'Connection failed';
  }

  // Update proxy status
  const updatedProxies = loadProxyPool();
  const updatedProxy = updatedProxies.find((p) => p.id === proxyId);
  if (updatedProxy) {
    updatedProxy.status = result.status;
    updatedProxy.lastCheckedAt = result.checkedAt;
    updatedProxy.responseTimeMs = result.responseTimeMs;
    updatedProxy.errorMessage = result.errorMessage;
    saveProxyPool(updatedProxies);
  }

  return result;
}

/**
 * Check health of all proxies in the pool
 */
export async function checkAllProxiesHealth(): Promise<ProxyHealthResult[]> {
  const proxies = loadProxyPool();
  const results: ProxyHealthResult[] = [];

  // Check proxies in parallel with concurrency limit
  const concurrency = 5;
  for (let i = 0; i < proxies.length; i += concurrency) {
    const batch = proxies.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map((p) => checkProxyHealth(p.id)));
    results.push(...batchResults);
  }

  return results;
}

/**
 * Test proxy connection without saving it
 * Used for validating proxy before adding to the pool
 */
export async function testProxyConnection(config: {
  host: string;
  port: number;
}): Promise<{
  success: boolean;
  responseTimeMs?: number;
  errorMessage?: string;
}> {
  const startTime = Date.now();

  try {
    await new Promise<void>((resolve, reject) => {
      const socket = net.createConnection({ host: config.host, port: config.port }, () => {
        socket.destroy();
        resolve();
      });
      socket.setTimeout(10000);
      socket.on('timeout', () => {
        socket.destroy();
        reject(new Error('Connection timeout'));
      });
      socket.on('error', reject);
    });

    return {
      success: true,
      responseTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      errorMessage: error instanceof Error ? error.message : 'Connection failed',
    };
  }
}

/**
 * Convert a SavedProxy to ProxyConfig for use with browser launch
 */
export function savedProxyToConfig(proxy: SavedProxy): {
  type: 'socks5' | 'http' | 'https';
  host: string;
  port: number;
  username?: string;
  password?: string;
} {
  return {
    type: proxy.type,
    host: proxy.host,
    port: proxy.port,
    username: proxy.username,
    password: proxy.password,
  };
}

/**
 * Detect and update the geolocation information for a proxy
 * Returns the detected geolocation or null if detection fails
 */
export async function detectAndUpdateProxyGeoLocation(
  proxyId: string
): Promise<GeoLocation | null> {
  const proxies = loadProxyPool();
  const proxy = proxies.find((p) => p.id === proxyId);

  if (!proxy) {
    throw new Error(`Proxy not found: ${proxyId}`);
  }

  // detectProxyGeoLocation will throw with specific error messages
  const geoLocation = await detectProxyGeoLocation({
    type: proxy.type,
    host: proxy.host,
    port: proxy.port,
    username: proxy.username,
    password: proxy.password,
  });

  if (geoLocation) {
    // Update proxy with geolocation
    const updatedProxies = loadProxyPool();
    const updatedProxy = updatedProxies.find((p) => p.id === proxyId);
    if (updatedProxy) {
      updatedProxy.geoLocation = geoLocation;
      updatedProxy.updatedAt = Date.now();
      saveProxyPool(updatedProxies);
    }
    return geoLocation;
  }

  return null;
}

/**
 * Create a proxy and optionally detect its geolocation
 * The geo detection runs asynchronously and doesn't block proxy creation
 */
export async function createProxyWithGeoDetection(
  input: CreateProxyInput,
  detectGeo: boolean = true
): Promise<SavedProxy> {
  const proxy = createProxy(input);

  // Detect geolocation asynchronously (don't block creation)
  if (detectGeo) {
    detectAndUpdateProxyGeoLocation(proxy.id).catch((err) => {
      console.error(`Background geo detection failed for ${proxy.id}:`, err);
    });
  }

  return proxy;
}

/**
 * Refresh geolocation for all proxies
 * Useful for batch updating location info
 */
export async function refreshAllProxiesGeoLocation(): Promise<{
  total: number;
  success: number;
  failed: number;
}> {
  const proxies = loadProxyPool();
  const results = { total: proxies.length, success: 0, failed: 0 };

  // Process in batches to avoid overwhelming APIs
  const batchSize = 3;
  for (let i = 0; i < proxies.length; i += batchSize) {
    const batch = proxies.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(
      batch.map((p) => detectAndUpdateProxyGeoLocation(p.id))
    );

    for (const result of batchResults) {
      if (result.status === 'fulfilled' && result.value) {
        results.success++;
      } else {
        results.failed++;
      }
    }

    // Small delay between batches to respect API rate limits
    if (i + batchSize < proxies.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  return results;
}
