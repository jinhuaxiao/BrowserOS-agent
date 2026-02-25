/**
 * MCP Port Discovery
 *
 * Utilities for discovering MCP server ports from BrowserOS instances.
 * Supports multiple discovery methods:
 * 1. Port scanning - Probe ports in a range for MCP servers
 * 2. File-based - Read mcp-info.json from user-data-dir
 * 3. CDP-based - Query Chrome DevTools Protocol for MCP info
 */

import { existsSync, readFileSync, watchFile, unwatchFile } from 'fs';
import { join } from 'path';
import type { McpInfoFile, ProfileMcpConfig } from './types.ts';

/**
 * Default port range for MCP server discovery
 */
export const DEFAULT_MCP_PORT_RANGE = {
  min: 9225,
  max: 9299,
};

/**
 * MCP discovery result
 */
export interface McpDiscoveryResult {
  /** Whether discovery was successful */
  success: boolean;

  /** Discovered port number */
  port?: number;

  /** Discovery method used */
  method?: 'scan' | 'file' | 'cdp';

  /** Error message if discovery failed */
  error?: string;

  /** Additional info from discovery */
  info?: McpInfoFile;
}

/**
 * Check if a port has an MCP server running
 * Uses HTTP HEAD request to the MCP endpoint
 */
async function probeMcpPort(
  port: number,
  host: string = '127.0.0.1',
  timeout: number = 1000
): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    // Try to fetch the MCP endpoint - BrowserOS typically serves at /mcp or /
    const response = await fetch(`http://${host}:${port}/`, {
      method: 'HEAD',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // MCP servers typically return 200 or a specific status
    // BrowserOS MCP might return various codes, we check if connection succeeded
    return response.ok || response.status < 500;
  } catch {
    return false;
  }
}

/**
 * Discover MCP port by scanning a range of ports
 *
 * @param minPort - Starting port (default: 9225)
 * @param maxPort - Ending port (default: 9299)
 * @param host - Host to scan (default: 127.0.0.1)
 * @returns Discovered port or null
 */
export async function discoverMcpPortByScanning(
  minPort: number = DEFAULT_MCP_PORT_RANGE.min,
  maxPort: number = DEFAULT_MCP_PORT_RANGE.max,
  host: string = '127.0.0.1'
): Promise<McpDiscoveryResult> {
  // Scan ports in parallel with concurrency limit
  const CONCURRENCY = 10;
  const ports: number[] = [];

  for (let port = minPort; port <= maxPort; port++) {
    ports.push(port);
  }

  // Scan in batches
  for (let i = 0; i < ports.length; i += CONCURRENCY) {
    const batch = ports.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (port) => ({
        port,
        available: await probeMcpPort(port, host),
      }))
    );

    const found = results.find((r) => r.available);
    if (found) {
      return {
        success: true,
        port: found.port,
        method: 'scan',
      };
    }
  }

  return {
    success: false,
    error: `No MCP server found in port range ${minPort}-${maxPort}`,
  };
}

/**
 * Discover all MCP ports in a range (finds all running instances)
 */
export async function discoverAllMcpPorts(
  minPort: number = DEFAULT_MCP_PORT_RANGE.min,
  maxPort: number = DEFAULT_MCP_PORT_RANGE.max,
  host: string = '127.0.0.1'
): Promise<number[]> {
  const CONCURRENCY = 20;
  const ports: number[] = [];
  const activePorts: number[] = [];

  for (let port = minPort; port <= maxPort; port++) {
    ports.push(port);
  }

  // Scan in batches
  for (let i = 0; i < ports.length; i += CONCURRENCY) {
    const batch = ports.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (port) => ({
        port,
        available: await probeMcpPort(port, host),
      }))
    );

    for (const r of results) {
      if (r.available) {
        activePorts.push(r.port);
      }
    }
  }

  return activePorts;
}

/**
 * Get path to MCP info file in user data directory
 */
export function getMcpInfoFilePath(userDataDir: string): string {
  return join(userDataDir, 'mcp-info.json');
}

/**
 * Read MCP info file from user data directory
 * BrowserOS writes this file after startup (Phase 2 feature)
 */
export function readMcpInfoFile(userDataDir: string): McpInfoFile | null {
  const infoPath = getMcpInfoFilePath(userDataDir);

  if (!existsSync(infoPath)) {
    return null;
  }

  try {
    const content = readFileSync(infoPath, 'utf-8');
    return JSON.parse(content) as McpInfoFile;
  } catch {
    return null;
  }
}

/**
 * Discover MCP port by reading info file from user data directory
 * This is the preferred method when BrowserOS supports writing the file
 */
export async function discoverMcpPortFromFile(
  userDataDir: string
): Promise<McpDiscoveryResult> {
  const info = readMcpInfoFile(userDataDir);

  if (info && info.port) {
    // Verify the port is still active
    const isActive = await probeMcpPort(info.port);

    if (isActive) {
      return {
        success: true,
        port: info.port,
        method: 'file',
        info,
      };
    } else {
      return {
        success: false,
        error: `MCP port ${info.port} from info file is not responding`,
      };
    }
  }

  return {
    success: false,
    error: 'MCP info file not found or invalid',
  };
}

/**
 * Watch for MCP info file creation
 * Useful when waiting for browser to start and write the file
 */
export function watchMcpInfoFile(
  userDataDir: string,
  callback: (info: McpInfoFile) => void,
  timeout: number = 30000
): { cancel: () => void } {
  const infoPath = getMcpInfoFilePath(userDataDir);
  let cancelled = false;
  let timeoutId: NodeJS.Timeout | undefined;

  const checkFile = () => {
    if (cancelled) return;

    const info = readMcpInfoFile(userDataDir);
    if (info) {
      cleanup();
      callback(info);
    }
  };

  const cleanup = () => {
    cancelled = true;
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    try {
      unwatchFile(infoPath);
    } catch {
      // Ignore errors during cleanup
    }
  };

  // Start watching
  watchFile(infoPath, { interval: 500 }, checkFile);

  // Check immediately in case file already exists
  checkFile();

  // Set timeout
  timeoutId = setTimeout(() => {
    cleanup();
  }, timeout);

  return { cancel: cleanup };
}

/**
 * Wait for MCP info file to appear
 * Returns a promise that resolves when the file is found
 */
export function waitForMcpInfoFile(
  userDataDir: string,
  timeout: number = 30000
): Promise<McpInfoFile | null> {
  return new Promise((resolve) => {
    const watcher = watchMcpInfoFile(
      userDataDir,
      (info) => {
        resolve(info);
      },
      timeout
    );

    // Set up timeout
    setTimeout(() => {
      watcher.cancel();
      resolve(null);
    }, timeout);
  });
}

/**
 * Discover MCP port using Chrome DevTools Protocol
 * Connects to the browser's debug port and queries for MCP info
 * Note: This requires the browser to be launched with --remote-debugging-port
 */
export async function discoverMcpPortViaCDP(
  debugPort: number,
  host: string = '127.0.0.1'
): Promise<McpDiscoveryResult> {
  try {
    // Query Chrome DevTools Protocol for version info
    const response = await fetch(`http://${host}:${debugPort}/json/version`, {
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return {
        success: false,
        error: `CDP endpoint returned ${response.status}`,
      };
    }

    const versionInfo = (await response.json()) as Record<string, unknown>;

    // BrowserOS may include MCP port in version info or we need to check extensions
    // For now, return the info we have - MCP port discovery via CDP may need
    // specific BrowserOS support
    if (versionInfo && typeof versionInfo.mcpPort === 'number') {
      return {
        success: true,
        port: versionInfo.mcpPort as number,
        method: 'cdp',
      };
    }

    return {
      success: false,
      error: 'MCP port not found in CDP version info',
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'CDP query failed',
    };
  }
}

/**
 * Multi-strategy MCP port discovery
 * Tries multiple methods in order of preference
 */
export async function discoverMcpPort(
  userDataDir?: string,
  config?: ProfileMcpConfig
): Promise<McpDiscoveryResult> {
  const host = config?.host || '127.0.0.1';
  const portRange = config?.portRange || DEFAULT_MCP_PORT_RANGE;

  // Method 1: Check if port is explicitly configured
  if (config?.port) {
    const isActive = await probeMcpPort(config.port, host);
    if (isActive) {
      return {
        success: true,
        port: config.port,
        method: 'scan', // Technically verification, not scan
      };
    }
  }

  // Method 2: Try reading from info file (if userDataDir provided)
  if (userDataDir) {
    const fileResult = await discoverMcpPortFromFile(userDataDir);
    if (fileResult.success) {
      return fileResult;
    }
  }

  // Method 3: Scan port range
  const scanResult = await discoverMcpPortByScanning(
    portRange.min,
    portRange.max,
    host
  );

  return scanResult;
}

/**
 * Wait for MCP server to become available on a specific port
 */
export async function waitForMcpServer(
  port: number,
  host: string = '127.0.0.1',
  timeout: number = 30000,
  pollInterval: number = 500
): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const isAvailable = await probeMcpPort(port, host);
    if (isAvailable) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  return false;
}

/**
 * Result of smart MCP server wait
 */
export interface SmartWaitResult {
  /** Whether the server became available */
  success: boolean;

  /** Actual time waited in ms */
  waitedMs: number;

  /** Number of attempts made */
  attempts: number;

  /** Error message if failed */
  error?: string;
}

/**
 * Wait for MCP server with exponential backoff
 *
 * Uses exponential backoff strategy for efficient waiting:
 * - Initial interval: 500ms
 * - Max interval: 2000ms
 * - Early exit when server is detected
 *
 * @param port - Port to check
 * @param host - Host address (default: 127.0.0.1)
 * @param timeout - Maximum wait time in ms (default: 30000)
 * @returns Result with success status and actual wait time
 */
export async function waitForMcpServerSmart(
  port: number,
  host: string = '127.0.0.1',
  timeout: number = 30000
): Promise<SmartWaitResult> {
  const startTime = Date.now();
  const INITIAL_INTERVAL = 500;
  const MAX_INTERVAL = 2000;
  const BACKOFF_FACTOR = 1.5;

  let interval = INITIAL_INTERVAL;
  let attempts = 0;

  while (Date.now() - startTime < timeout) {
    attempts++;

    const isAvailable = await probeMcpPort(port, host);
    if (isAvailable) {
      return {
        success: true,
        waitedMs: Date.now() - startTime,
        attempts,
      };
    }

    // Calculate remaining time
    const elapsed = Date.now() - startTime;
    const remaining = timeout - elapsed;

    if (remaining <= 0) {
      break;
    }

    // Wait with exponential backoff
    const waitTime = Math.min(interval, remaining);
    await new Promise((resolve) => setTimeout(resolve, waitTime));

    // Increase interval for next iteration (exponential backoff)
    interval = Math.min(interval * BACKOFF_FACTOR, MAX_INTERVAL);
  }

  return {
    success: false,
    waitedMs: Date.now() - startTime,
    attempts,
    error: `MCP server not available on port ${port} after ${timeout}ms`,
  };
}

/**
 * Options for fast port discovery
 */
export interface FastDiscoveryOptions {
  /** Concurrency level (default: 20) */
  concurrency?: number;

  /** Per-port probe timeout in ms (default: 1000) */
  probeTimeout?: number;

  /** Stop after finding first available port (default: true) */
  stopOnFirst?: boolean;
}

/**
 * Result of fast port discovery
 */
export interface FastDiscoveryResult {
  /** Whether discovery found an available port */
  success: boolean;

  /** Discovered port (if success) */
  port?: number;

  /** All available ports found (if stopOnFirst is false) */
  allPorts?: number[];

  /** Time taken in ms */
  timeMs: number;

  /** Number of ports scanned */
  portsScanned: number;
}

/**
 * Discover MCP port with optimized parallel scanning
 *
 * Key optimizations:
 * - Higher concurrency (configurable, default 20)
 * - Returns immediately when first port found
 * - Promise.race for early termination
 *
 * @param minPort - Starting port (default: 9225)
 * @param maxPort - Ending port (default: 9299)
 * @param host - Host to scan (default: 127.0.0.1)
 * @param options - Discovery options
 */
export async function discoverMcpPortFast(
  minPort: number = DEFAULT_MCP_PORT_RANGE.min,
  maxPort: number = DEFAULT_MCP_PORT_RANGE.max,
  host: string = '127.0.0.1',
  options?: FastDiscoveryOptions
): Promise<FastDiscoveryResult> {
  const startTime = Date.now();
  const concurrency = options?.concurrency ?? 20;
  const probeTimeout = options?.probeTimeout ?? 1000;
  const stopOnFirst = options?.stopOnFirst ?? true;

  const ports: number[] = [];
  for (let port = minPort; port <= maxPort; port++) {
    ports.push(port);
  }

  const foundPorts: number[] = [];
  let portsScanned = 0;
  let earlyExit = false;

  // Process ports in batches with early termination support
  for (let i = 0; i < ports.length && !earlyExit; i += concurrency) {
    const batch = ports.slice(i, i + concurrency);

    const results = await Promise.all(
      batch.map(async (port) => {
        if (earlyExit) return { port, available: false };

        const available = await probeMcpPort(port, host, probeTimeout);
        portsScanned++;

        return { port, available };
      })
    );

    for (const r of results) {
      if (r.available) {
        foundPorts.push(r.port);

        if (stopOnFirst) {
          earlyExit = true;
          break;
        }
      }
    }
  }

  const timeMs = Date.now() - startTime;

  if (foundPorts.length > 0) {
    return {
      success: true,
      port: foundPorts[0],
      allPorts: stopOnFirst ? undefined : foundPorts,
      timeMs,
      portsScanned,
    };
  }

  return {
    success: false,
    timeMs,
    portsScanned,
  };
}

/**
 * Calculate port number based on profile ID using hash
 * Provides consistent port assignment for a given profile
 */
export function calculatePortFromProfileId(
  profileId: string,
  basePort: number = 9100,
  maxPort: number = 9199
): number {
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < profileId.length; i++) {
    const char = profileId.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  const range = maxPort - basePort + 1;
  const offset = Math.abs(hash) % range;

  return basePort + offset;
}

/**
 * Find next available port in a range
 * Used for sequential port allocation
 */
export async function findNextAvailablePort(
  usedPorts: Set<number>,
  basePort: number = 9100,
  maxPort: number = 9199,
  host: string = '127.0.0.1'
): Promise<number | null> {
  for (let port = basePort; port <= maxPort; port++) {
    if (!usedPorts.has(port)) {
      // Verify port is not in use by checking if connection fails
      const isUsed = await probeMcpPort(port, host);
      if (!isUsed) {
        return port;
      }
    }
  }

  return null;
}
