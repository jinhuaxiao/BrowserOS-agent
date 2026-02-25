/**
 * Nova Seller Browser - Branding Configuration
 *
 * Centralized configuration for the Nova Seller browser brand.
 * A specialized fingerprint browser for Amazon sellers and e-commerce multi-account management.
 */

import { join } from 'path';
import { platform } from 'os';
import { existsSync, readFileSync } from 'fs';

/**
 * Nova Seller branding information
 */
export const NOVA_SELLER_BRAND = {
  /** Application name */
  appName: 'Nova Seller',

  /** Short name for file naming */
  shortName: 'NovaSeller',

  /** Display name (with space) */
  displayName: 'Nova Seller Browser',

  /** Company name */
  companyName: 'Nova Seller',

  /** Bundle identifier for macOS */
  bundleId: 'com.novaseller.browser',

  /** Product description */
  description: 'Professional fingerprint browser for Amazon sellers and e-commerce multi-account management',

  /** Copyright notice */
  copyright: `Copyright ${new Date().getFullYear()} Nova Seller. All rights reserved.`,

  /** Version */
  version: '1.0.0',

  /** Website */
  website: 'https://novaseller.com',
} as const;

/**
 * Platform-specific application paths
 */
export const NOVA_SELLER_PATHS: Record<string, string[]> = {
  darwin: [
    '/Applications/Nova Seller.app/Contents/MacOS/Nova Seller',
    '/Applications/NovaSeller.app/Contents/MacOS/NovaSeller',
    // Fallback to BrowserOS/Chromium/Chrome
    '/Applications/BrowserOS.app/Contents/MacOS/BrowserOS',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ],
  linux: [
    '/usr/bin/nova-seller',
    '/usr/bin/novaseller',
    '/opt/nova-seller/nova-seller',
    // Fallback
    '/usr/bin/browseros',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
  ],
  win32: [
    'C:\\Program Files\\Nova Seller\\Nova Seller.exe',
    'C:\\Program Files\\NovaSeller\\NovaSeller.exe',
    // Fallback
    'C:\\Program Files\\BrowserOS\\BrowserOS.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ],
};

/**
 * Icon configuration
 */
export const NOVA_SELLER_ICONS = {
  /** Source icon path (v3 design - North Star) */
  source: 'nova-browser-icon-v3.png',

  /** Icon sizes to generate */
  sizes: [16, 32, 48, 64, 128, 256, 512, 1024] as const,

  /** Output directory for generated icons */
  outputDir: 'resources/icons',

  /** macOS icon set name */
  iconsetName: 'NovaSeller.iconset',

  /** macOS .icns file */
  icnsFile: 'NovaSeller.icns',

  /** Windows .ico file */
  icoFile: 'NovaSeller.ico',
} as const;

/**
 * Configuration file names
 */
export const NOVA_SELLER_FILES = {
  /** Kernel fingerprint configuration */
  fingerprintConfig: 'novaseller_fingerprint.conf',

  /** Profile configuration */
  profileConfig: 'config.json',

  /** Extensions directory */
  extensionsDir: 'Nova Seller Extensions',

  /** MCP info file */
  mcpInfoFile: 'mcp-info.json',
} as const;

/**
 * Environment variable names
 */
export const NOVA_SELLER_ENV = {
  /** Fingerprint config path */
  fingerprintConfig: 'NOVA_SELLER_FINGERPRINT_CONFIG',

  /** TLS profile */
  tlsProfile: 'NOVA_SELLER_TLS_PROFILE',

  /** Debug mode */
  debug: 'NOVA_SELLER_DEBUG',
} as const;

/**
 * Check if Nova Seller browser is available
 */
export function isNovaSellerAvailable(): boolean {
  const currentPlatform = platform();
  const paths = NOVA_SELLER_PATHS[currentPlatform] || [];

  // Only check Nova Seller-specific paths (first two entries)
  const novaSellerPaths = paths.slice(0, 2);
  return novaSellerPaths.some((p) => existsSync(p));
}

/**
 * Get Nova Seller executable path
 * @returns Path to executable or null if not found
 */
export function getNovaSellerPath(): string | null {
  const currentPlatform = platform();
  const paths = NOVA_SELLER_PATHS[currentPlatform] || [];

  for (const p of paths) {
    if (existsSync(p)) {
      return p;
    }
  }

  return null;
}

/**
 * Check if a browser path is Nova Seller
 */
export function isNovaSeller(browserPath: string): boolean {
  const lowerPath = browserPath.toLowerCase();
  return (
    lowerPath.includes('nova seller') ||
    lowerPath.includes('novaseller') ||
    lowerPath.includes('nova-seller')
  );
}

/**
 * Get extensions directory path for Nova Seller
 * @param browserPath Path to browser executable
 * @returns Extensions directory path or null
 */
export function getNovaSellerExtensionsDir(browserPath: string): string | null {
  const currentPlatform = platform();

  if (currentPlatform === 'darwin') {
    // macOS: /Applications/Nova Seller.app/Contents/Frameworks/...
    const appPath = browserPath.replace(/\/Contents\/MacOS\/[^/]+$/, '');

    // Framework names to check (Nova Seller first, then BrowserOS for compatibility)
    const frameworkNames = [
      'Nova Seller Framework.framework',
      'NovaSeller Framework.framework',
      'BrowserOS Framework.framework', // Fallback if built from BrowserOS base
    ];

    // Extension directory names to check
    const extensionDirNames = [
      'novaseller_extensions',
      'browseros_extensions',
      'extensions',
    ];

    for (const frameworkName of frameworkNames) {
      const frameworkPath = join(appPath, 'Contents/Frameworks', frameworkName, 'Versions');

      if (!existsSync(frameworkPath)) {
        continue;
      }

      // Try 'Current' symlink first
      for (const extDirName of extensionDirNames) {
        const currentPath = join(frameworkPath, 'Current/Resources', extDirName);
        if (existsSync(currentPath)) {
          return currentPath;
        }
      }

      // Fallback: look for any version directory
      try {
        const versions = require('fs').readdirSync(frameworkPath)
          .filter((v: string) => !v.startsWith('.') && v !== 'Current');
        for (const version of versions) {
          for (const extDirName of extensionDirNames) {
            const extPath = join(frameworkPath, version, 'Resources', extDirName);
            if (existsSync(extPath)) {
              return extPath;
            }
          }
        }
      } catch {
        continue;
      }
    }

    return null;
  } else if (currentPlatform === 'linux') {
    const possiblePaths = [
      '/opt/nova-seller/resources/extensions',
      '/opt/nova-seller/resources/novaseller_extensions',
      '/opt/nova-seller/resources/browseros_extensions',
      '/usr/share/nova-seller/resources/extensions',
    ];
    for (const p of possiblePaths) {
      if (existsSync(p)) {
        return p;
      }
    }
  } else if (currentPlatform === 'win32') {
    const appDir = browserPath.replace(/[/\\][^/\\]+\.exe$/i, '');
    const extDirNames = ['extensions', 'novaseller_extensions', 'browseros_extensions'];
    for (const extDirName of extDirNames) {
      const extPath = join(appDir, 'resources', extDirName);
      if (existsSync(extPath)) {
        return extPath;
      }
    }
  }

  return null;
}

/**
 * Build Nova Seller specific launch arguments
 */
export interface NovaSellerLaunchOptions {
  /** Profile ID */
  profileId: string;
  /** User data directory */
  userDataDir: string;
  /** Fingerprint config path */
  fingerprintConfigPath?: string;
  /** Startup URL */
  startupUrl?: string;
  /** Additional arguments */
  additionalArgs?: string[];
}

/**
 * Get Nova Seller specific command line arguments
 */
export function getNovaSellerArgs(options: NovaSellerLaunchOptions): string[] {
  const args: string[] = [];

  // User data directory for profile isolation
  args.push(`--user-data-dir=${options.userDataDir}`);

  // Fingerprint configuration
  if (options.fingerprintConfigPath) {
    args.push(`--fingerprint-config=${options.fingerprintConfigPath}`);
    try {
      const base64 = readFileSync(options.fingerprintConfigPath).toString('base64');
      if (base64) {
        args.push(`--fingerprint-config-base64=${base64}`);
      }
    } catch {
      // Ignore base64 generation errors and fall back to file path
    }
  }

  // Nova Seller has built-in anti-detection, so we use minimal flags
  args.push(
    '--disable-infobars',
    '--no-first-run',
    '--no-default-browser-check'
  );

  // Startup URL
  if (options.startupUrl) {
    args.push(options.startupUrl);
  }

  // Additional arguments
  if (options.additionalArgs) {
    args.push(...options.additionalArgs);
  }

  return args;
}

/**
 * Get environment variables for Nova Seller
 */
export function getNovaSellerEnv(
  fingerprintConfigPath?: string,
  timezone?: string
): NodeJS.ProcessEnv {
  const env = { ...process.env };

  if (fingerprintConfigPath) {
    env[NOVA_SELLER_ENV.fingerprintConfig] = fingerprintConfigPath;
  }

  if (timezone) {
    env.TZ = timezone;
  }

  return env;
}
