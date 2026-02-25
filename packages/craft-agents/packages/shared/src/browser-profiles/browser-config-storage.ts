/**
 * Browser Configuration Storage
 *
 * Persists browser configuration (custom paths, preferences) to disk.
 * Storage location: ~/.craft-agent/browser-config.json
 *
 * Environment variables:
 * - CRAFT_BROWSER_PATH: Override browser executable path
 * - CRAFT_BROWSER_TYPE: Override browser type (nova-seller, browseros, chrome, chromium)
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import type { BrowserConfig, StoredBrowserConfig, BrowserType } from './types.ts';

/**
 * Environment variable names for browser configuration
 */
export const BROWSER_ENV_VARS = {
  /** Custom browser executable path */
  BROWSER_PATH: 'CRAFT_BROWSER_PATH',
  /** Browser type preference */
  BROWSER_TYPE: 'CRAFT_BROWSER_TYPE',
} as const;

/**
 * Configuration file path
 */
const CONFIG_DIR = join(homedir(), '.craft-agent');
const CONFIG_FILE = join(CONFIG_DIR, 'browser-config.json');

/**
 * Current config version for migration support
 */
const CONFIG_VERSION = 1;

/**
 * In-memory cache of the current configuration
 */
let cachedConfig: StoredBrowserConfig | null = null;

/**
 * Ensure the configuration directory exists
 */
function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

/**
 * Load browser configuration from disk
 * Returns cached version if available
 */
export function loadBrowserConfig(): StoredBrowserConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  if (!existsSync(CONFIG_FILE)) {
    cachedConfig = { version: CONFIG_VERSION };
    return cachedConfig;
  }

  try {
    const content = readFileSync(CONFIG_FILE, 'utf-8');
    const config = JSON.parse(content) as StoredBrowserConfig;

    // Validate and migrate if needed
    if (!config.version || config.version < CONFIG_VERSION) {
      config.version = CONFIG_VERSION;
      saveBrowserConfig(config);
    }

    cachedConfig = config;
    return config;
  } catch (err) {
    console.warn('[BrowserConfig] Failed to load config:', err);
    cachedConfig = { version: CONFIG_VERSION };
    return cachedConfig;
  }
}

/**
 * Save browser configuration to disk
 */
export function saveBrowserConfig(config: StoredBrowserConfig): void {
  ensureConfigDir();

  const configToSave: StoredBrowserConfig = {
    ...config,
    version: CONFIG_VERSION,
    updatedAt: Date.now(),
  };

  try {
    writeFileSync(CONFIG_FILE, JSON.stringify(configToSave, null, 2), 'utf-8');
    cachedConfig = configToSave;
  } catch (err) {
    console.error('[BrowserConfig] Failed to save config:', err);
    throw err;
  }
}

/**
 * Set custom browser path
 *
 * @param path - Path to browser executable
 * @param options - Additional options
 */
export function setBrowserPath(
  path: string,
  options?: {
    useCustomPathOnly?: boolean;
    browserType?: BrowserType;
  }
): void {
  // Validate path exists
  if (!existsSync(path)) {
    throw new Error(`Browser executable not found: ${path}`);
  }

  const config = loadBrowserConfig();

  config.customBrowserPath = path;

  if (options?.useCustomPathOnly !== undefined) {
    config.useCustomPathOnly = options.useCustomPathOnly;
  }

  if (options?.browserType) {
    config.browserType = options.browserType;
  }

  saveBrowserConfig(config);
  console.log(`[BrowserConfig] Browser path set to: ${path}`);
}

/**
 * Clear custom browser path (revert to default discovery)
 */
export function clearCustomBrowserPath(): void {
  const config = loadBrowserConfig();

  delete config.customBrowserPath;
  delete config.useCustomPathOnly;

  saveBrowserConfig(config);
  console.log('[BrowserConfig] Custom browser path cleared');
}

/**
 * Get current browser configuration
 */
export function getBrowserConfig(): BrowserConfig {
  const stored = loadBrowserConfig();

  return {
    customBrowserPath: stored.customBrowserPath,
    useCustomPathOnly: stored.useCustomPathOnly,
    browserType: stored.browserType,
  };
}

/**
 * Check if a custom browser path is configured
 */
export function hasCustomBrowserPath(): boolean {
  const config = loadBrowserConfig();
  return !!config.customBrowserPath;
}

/**
 * Get the custom browser path if configured
 */
export function getCustomBrowserPath(): string | null {
  const config = loadBrowserConfig();
  return config.customBrowserPath || null;
}

/**
 * Check if the configured custom path is valid (exists and is executable)
 */
export function validateCustomBrowserPath(): { valid: boolean; error?: string } {
  const config = loadBrowserConfig();

  if (!config.customBrowserPath) {
    return { valid: true }; // No custom path is valid (will use defaults)
  }

  if (!existsSync(config.customBrowserPath)) {
    return {
      valid: false,
      error: `Browser executable not found: ${config.customBrowserPath}`,
    };
  }

  // Additional platform-specific validation could go here
  // (e.g., checking if file is executable on Unix)

  return { valid: true };
}

/**
 * Clear the in-memory cache (for testing)
 */
export function clearConfigCache(): void {
  cachedConfig = null;
}

/**
 * Get the config file path (for debugging)
 */
export function getConfigFilePath(): string {
  return CONFIG_FILE;
}
