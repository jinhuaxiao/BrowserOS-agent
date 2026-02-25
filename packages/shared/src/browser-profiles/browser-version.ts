/**
 * Browser Version Detection
 *
 * Detects the actual Chrome/Chromium browser version from the executable
 * and generates matching User Agent strings to avoid fingerprint mismatches.
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { platform } from 'os';

/**
 * Result of browser version detection
 */
export interface BrowserVersionInfo {
  /** Full version string (e.g., "142.0.6367.91") */
  fullVersion: string;
  /** Major version number (e.g., 142) */
  majorVersion: number;
  /** Minor version number (e.g., 0) */
  minorVersion: number;
  /** Build number (e.g., 6367) */
  buildNumber: number;
  /** Patch number (e.g., 91) */
  patchNumber: number;
}

/**
 * Generated User Agent info
 */
export interface UserAgentInfo {
  userAgent: string;
  appVersion: string;
  platform: string;
}

/**
 * Cached browser version to avoid repeated detection
 */
let cachedVersion: BrowserVersionInfo | null = null;
let cachedBrowserPath: string | null = null;

/**
 * Known real Chrome release versions by major version
 * These are actual Chrome stable release versions that won't be flagged by fingerprint detection
 * Source: https://chromiumdash.appspot.com/releases
 *
 * When the detected browser version doesn't match known Chrome builds (e.g., BrowserOS),
 * we use these real versions to avoid detection.
 */
const KNOWN_CHROME_VERSIONS: Record<number, string[]> = {
  // Chrome 136-145 (2025)
  145: ['145.0.7422.54', '145.0.7422.41', '145.0.7422.29'],
  144: ['144.0.7376.97', '144.0.7376.81', '144.0.7376.69'],
  143: ['143.0.7341.93', '143.0.7341.79', '143.0.7341.67'],
  142: ['142.0.7313.116', '142.0.7313.101', '142.0.7313.88'],
  141: ['141.0.7278.98', '141.0.7278.79', '141.0.7278.64'],
  140: ['140.0.7243.122', '140.0.7243.105', '140.0.7243.91'],
  139: ['139.0.7208.92', '139.0.7208.78', '139.0.7208.63'],
  138: ['138.0.7173.114', '138.0.7173.98', '138.0.7173.85'],
  137: ['137.0.7137.92', '137.0.7137.78', '137.0.7137.65'],
  136: ['136.0.7103.115', '136.0.7103.99', '136.0.7103.86'],
  // Chrome 130-135 (late 2024)
  135: ['135.0.7065.101', '135.0.7065.87', '135.0.7065.72'],
  134: ['134.0.7029.97', '134.0.7029.83', '134.0.7029.69'],
  133: ['133.0.6993.91', '133.0.6993.77', '133.0.6993.62'],
  132: ['132.0.6957.98', '132.0.6957.84', '132.0.6957.71'],
  131: ['131.0.6921.96', '131.0.6921.82', '131.0.6921.69'],
  130: ['130.0.6885.105', '130.0.6885.91', '130.0.6885.78'],
};

/**
 * Known Chrome build number ranges by major version
 * Used to validate if a detected version is a real Chrome build
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
};

/**
 * Check if a version appears to be a real Chrome release
 * BrowserOS and other Chromium forks may have different build numbers
 */
function isRealChromeVersion(version: BrowserVersionInfo): boolean {
  const range = CHROME_BUILD_RANGES[version.majorVersion];
  if (!range) {
    // Unknown major version, assume it's real
    return true;
  }

  const [minBuild, maxBuild] = range;
  return version.buildNumber >= minBuild && version.buildNumber <= maxBuild;
}

/**
 * Get a real Chrome version for a given major version
 * Used when the detected version is not a real Chrome release
 */
function getRealChromeVersion(majorVersion: number): string | null {
  const versions = KNOWN_CHROME_VERSIONS[majorVersion];
  if (versions && versions.length > 0) {
    // Return the first (most recent) known version
    return versions[0];
  }

  // Try to find the closest major version
  const availableVersions = Object.keys(KNOWN_CHROME_VERSIONS)
    .map(Number)
    .sort((a, b) => b - a);

  for (const ver of availableVersions) {
    if (ver <= majorVersion) {
      const fallbackVersions = KNOWN_CHROME_VERSIONS[ver];
      if (fallbackVersions && fallbackVersions.length > 0) {
        return fallbackVersions[0];
      }
    }
  }

  return null;
}

/**
 * Detect browser version from executable
 *
 * Uses multiple detection methods depending on platform:
 * - macOS: Read Info.plist or run --version
 * - Windows: Read PE file version info or run --version
 * - Linux: Run --version
 *
 * @param browserPath - Path to the browser executable
 * @returns Version info or null if detection fails
 */
export async function detectBrowserVersion(
  browserPath: string
): Promise<BrowserVersionInfo | null> {
  // Return cached version if same browser path
  if (cachedVersion && cachedBrowserPath === browserPath) {
    return cachedVersion;
  }

  if (!existsSync(browserPath)) {
    return null;
  }

  const currentPlatform = platform();
  let versionString: string | null = null;

  try {
    switch (currentPlatform) {
      case 'darwin':
        versionString = detectMacOSVersion(browserPath);
        break;
      case 'win32':
        versionString = detectWindowsVersion(browserPath);
        break;
      case 'linux':
        versionString = detectLinuxVersion(browserPath);
        break;
      default:
        versionString = detectVersionFromCLI(browserPath);
    }

    if (!versionString) {
      // Fallback to CLI detection
      versionString = detectVersionFromCLI(browserPath);
    }

    if (!versionString) {
      return null;
    }

    const version = parseVersionString(versionString);
    if (version) {
      cachedVersion = version;
      cachedBrowserPath = browserPath;
    }

    return version;
  } catch (error) {
    console.warn('[BrowserVersion] Detection failed:', error);
    return null;
  }
}

/**
 * Detect browser version on macOS
 * Reads Info.plist from the app bundle
 */
function detectMacOSVersion(browserPath: string): string | null {
  try {
    // Browser path is usually: /Applications/App.app/Contents/MacOS/executable
    // Info.plist is at: /Applications/App.app/Contents/Info.plist
    const appPath = browserPath.replace(/\/Contents\/MacOS\/[^/]+$/, '');
    const infoPlistPath = join(appPath, 'Contents', 'Info.plist');

    if (existsSync(infoPlistPath)) {
      // Use plutil to read the plist as JSON
      try {
        const jsonOutput = execSync(
          `plutil -convert json -o - "${infoPlistPath}"`,
          { encoding: 'utf-8', timeout: 5000 }
        );
        const plist = JSON.parse(jsonOutput);

        // Try different version keys
        const version =
          plist.CFBundleShortVersionString ||
          plist.CFBundleVersion ||
          plist.KSVersion;

        if (version && /^\d+\.\d+/.test(version)) {
          return version;
        }
      } catch {
        // plutil failed, try reading as XML
        const plistContent = readFileSync(infoPlistPath, 'utf-8');

        // Extract version from XML plist
        const versionMatch = plistContent.match(
          /<key>CFBundleShortVersionString<\/key>\s*<string>([^<]+)<\/string>/
        );
        if (versionMatch && versionMatch[1]) {
          return versionMatch[1];
        }

        // Try CFBundleVersion
        const bundleMatch = plistContent.match(
          /<key>CFBundleVersion<\/key>\s*<string>([^<]+)<\/string>/
        );
        if (bundleMatch && bundleMatch[1]) {
          return bundleMatch[1];
        }
      }
    }

    // Fallback to CLI
    return detectVersionFromCLI(browserPath);
  } catch {
    return null;
  }
}

/**
 * Detect browser version on Windows
 * Uses PowerShell to read file version info
 */
function detectWindowsVersion(browserPath: string): string | null {
  try {
    // Use PowerShell to get file version
    const psCommand = `(Get-Item "${browserPath.replace(/"/g, '`"')}").VersionInfo.ProductVersion`;
    const version = execSync(`powershell -Command "${psCommand}"`, {
      encoding: 'utf-8',
      timeout: 5000,
    }).trim();

    if (version && /^\d+\.\d+/.test(version)) {
      return version;
    }

    // Fallback to CLI
    return detectVersionFromCLI(browserPath);
  } catch {
    return detectVersionFromCLI(browserPath);
  }
}

/**
 * Detect browser version on Linux
 * Uses --version command
 */
function detectLinuxVersion(browserPath: string): string | null {
  return detectVersionFromCLI(browserPath);
}

/**
 * Detect version by running the browser with --version flag
 * Works on all platforms as a fallback
 */
function detectVersionFromCLI(browserPath: string): string | null {
  try {
    const output = execSync(`"${browserPath}" --version`, {
      encoding: 'utf-8',
      timeout: 10000,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();

    // Parse version from output like:
    // "Chromium 142.0.6367.91 Arch Linux"
    // "Google Chrome 142.0.6367.91"
    // "BrowserOS 142.0.6367.91"
    const versionMatch = output.match(/(?:Chrome|Chromium|BrowserOS)\s+(\d+\.\d+\.\d+(?:\.\d+)?)/i);
    if (versionMatch && versionMatch[1]) {
      return versionMatch[1];
    }

    // Try to find any version pattern
    const genericMatch = output.match(/(\d+\.\d+\.\d+(?:\.\d+)?)/);
    if (genericMatch && genericMatch[1]) {
      return genericMatch[1];
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Parse a version string into structured format
 */
function parseVersionString(versionString: string): BrowserVersionInfo | null {
  // Match version patterns like "142.0.6367.91" or "142.0.6367"
  const match = versionString.match(/^(\d+)\.(\d+)\.(\d+)(?:\.(\d+))?/);
  if (!match || !match[1] || !match[2] || !match[3]) {
    return null;
  }

  return {
    fullVersion: versionString,
    majorVersion: parseInt(match[1], 10),
    minorVersion: parseInt(match[2], 10),
    buildNumber: parseInt(match[3], 10),
    patchNumber: match[4] ? parseInt(match[4], 10) : 0,
  };
}

/**
 * Generate a User Agent string matching the detected browser version
 *
 * @param version - Detected browser version info
 * @param targetPlatform - Target platform for the fingerprint
 * @returns User Agent info with userAgent, appVersion, and platform strings
 */
export function generateUserAgent(
  version: BrowserVersionInfo,
  targetPlatform: 'windows' | 'macos' | 'linux'
): UserAgentInfo {
  // If the browser version is not a known Chrome release (e.g. Nova Seller, BrowserOS),
  // use a real Chrome version for the same major version to avoid detection.
  // Detection sites flag unknown build numbers as antidetect browsers.
  let chromeVersion: string;

  if (isRealChromeVersion(version)) {
    chromeVersion = version.fullVersion ||
      `${version.majorVersion}.${version.minorVersion}.${version.buildNumber || 0}.${version.patchNumber || 0}`;
  } else {
    const realVersion = getRealChromeVersion(version.majorVersion);
    if (realVersion) {
      chromeVersion = realVersion;
    } else {
      // No known version for this major, use as-is
      chromeVersion = version.fullVersion ||
        `${version.majorVersion}.${version.minorVersion}.${version.buildNumber || 0}.${version.patchNumber || 0}`;
    }
  }

  switch (targetPlatform) {
    case 'windows':
      return {
        userAgent: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`,
        appVersion: `5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`,
        platform: 'Win32',
      };
    case 'macos':
      return {
        userAgent: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`,
        appVersion: `5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`,
        platform: 'MacIntel',
      };
    case 'linux':
      return {
        userAgent: `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`,
        appVersion: `5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`,
        platform: 'Linux x86_64',
      };
  }
}

/**
 * Generate User Agent from version string (convenience function)
 *
 * @param versionString - Version string like "142.0.6367.91"
 * @param targetPlatform - Target platform for the fingerprint
 * @returns User Agent info or null if version parsing fails
 */
export function generateUserAgentFromVersion(
  versionString: string,
  targetPlatform: 'windows' | 'macos' | 'linux'
): UserAgentInfo | null {
  const version = parseVersionString(versionString);
  if (!version) {
    return null;
  }
  return generateUserAgent(version, targetPlatform);
}

/**
 * Clear the cached browser version
 * Useful when the browser is updated
 */
export function clearVersionCache(): void {
  cachedVersion = null;
  cachedBrowserPath = null;
}

/**
 * Get the cached browser version without re-detecting
 */
export function getCachedVersion(): BrowserVersionInfo | null {
  return cachedVersion;
}
