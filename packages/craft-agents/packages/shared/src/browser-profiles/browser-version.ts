/**
 * Browser Version Detection
 *
 * Detects the actual Chrome/Chromium browser version from the executable
 * and generates matching User Agent strings to avoid fingerprint mismatches.
 */

import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { platform } from 'node:os'
import { join } from 'node:path'

/**
 * Result of browser version detection
 */
export interface BrowserVersionInfo {
  /** Full version string (e.g., "142.0.6367.91") */
  fullVersion: string
  /** Major version number (e.g., 142) */
  majorVersion: number
  /** Minor version number (e.g., 0) */
  minorVersion: number
  /** Build number (e.g., 6367) */
  buildNumber: number
  /** Patch number (e.g., 91) */
  patchNumber: number
}

/**
 * Generated User Agent info
 */
export interface UserAgentInfo {
  userAgent: string
  appVersion: string
  platform: string
}

/**
 * Cached browser version to avoid repeated detection
 */
let cachedVersion: BrowserVersionInfo | null = null
let cachedBrowserPath: string | null = null

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
  browserPath: string,
): Promise<BrowserVersionInfo | null> {
  // Return cached version if same browser path
  if (cachedVersion && cachedBrowserPath === browserPath) {
    return cachedVersion
  }

  if (!existsSync(browserPath)) {
    return null
  }

  const currentPlatform = platform()
  let versionString: string | null = null

  try {
    switch (currentPlatform) {
      case 'darwin':
        versionString = detectMacOSVersion(browserPath)
        break
      case 'win32':
        versionString = detectWindowsVersion(browserPath)
        break
      case 'linux':
        versionString = detectLinuxVersion(browserPath)
        break
      default:
        versionString = detectVersionFromCLI(browserPath)
    }

    if (!versionString) {
      // Fallback to CLI detection
      versionString = detectVersionFromCLI(browserPath)
    }

    if (!versionString) {
      return null
    }

    const version = parseVersionString(versionString)
    if (version) {
      cachedVersion = version
      cachedBrowserPath = browserPath
    }

    return version
  } catch (error) {
    console.warn('[BrowserVersion] Detection failed:', error)
    return null
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
    const appPath = browserPath.replace(/\/Contents\/MacOS\/[^/]+$/, '')
    const infoPlistPath = join(appPath, 'Contents', 'Info.plist')

    if (existsSync(infoPlistPath)) {
      // Use plutil to read the plist as JSON
      try {
        const jsonOutput = execSync(
          `plutil -convert json -o - "${infoPlistPath}"`,
          { encoding: 'utf-8', timeout: 5000 },
        )
        const plist = JSON.parse(jsonOutput)

        // Try different version keys
        const version =
          plist.CFBundleShortVersionString ||
          plist.CFBundleVersion ||
          plist.KSVersion

        if (version && /^\d+\.\d+/.test(version)) {
          return version
        }
      } catch {
        // plutil failed, try reading as XML
        const plistContent = readFileSync(infoPlistPath, 'utf-8')

        // Extract version from XML plist
        const versionMatch = plistContent.match(
          /<key>CFBundleShortVersionString<\/key>\s*<string>([^<]+)<\/string>/,
        )
        if (versionMatch?.[1]) {
          return versionMatch[1]
        }

        // Try CFBundleVersion
        const bundleMatch = plistContent.match(
          /<key>CFBundleVersion<\/key>\s*<string>([^<]+)<\/string>/,
        )
        if (bundleMatch?.[1]) {
          return bundleMatch[1]
        }
      }
    }

    // Fallback to CLI
    return detectVersionFromCLI(browserPath)
  } catch {
    return null
  }
}

/**
 * Detect browser version on Windows
 * Uses PowerShell to read file version info
 */
function detectWindowsVersion(browserPath: string): string | null {
  try {
    // Use PowerShell to get file version
    const psCommand = `(Get-Item "${browserPath.replace(/"/g, '`"')}").VersionInfo.ProductVersion`
    const version = execSync(`powershell -Command "${psCommand}"`, {
      encoding: 'utf-8',
      timeout: 5000,
    }).trim()

    if (version && /^\d+\.\d+/.test(version)) {
      return version
    }

    // Fallback to CLI
    return detectVersionFromCLI(browserPath)
  } catch {
    return detectVersionFromCLI(browserPath)
  }
}

/**
 * Detect browser version on Linux
 * Uses --version command
 */
function detectLinuxVersion(browserPath: string): string | null {
  return detectVersionFromCLI(browserPath)
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
    }).trim()

    // Parse version from output like:
    // "Chromium 142.0.6367.91 Arch Linux"
    // "Google Chrome 142.0.6367.91"
    // "BrowserOS 142.0.6367.91"
    const versionMatch = output.match(
      /(?:Chrome|Chromium|BrowserOS)\s+(\d+\.\d+\.\d+(?:\.\d+)?)/i,
    )
    if (versionMatch?.[1]) {
      return versionMatch[1]
    }

    // Try to find any version pattern
    const genericMatch = output.match(/(\d+\.\d+\.\d+(?:\.\d+)?)/)
    if (genericMatch?.[1]) {
      return genericMatch[1]
    }

    return null
  } catch {
    return null
  }
}

/**
 * Parse a version string into structured format
 */
function parseVersionString(versionString: string): BrowserVersionInfo | null {
  // Match version patterns like "142.0.6367.91" or "142.0.6367"
  const match = versionString.match(/^(\d+)\.(\d+)\.(\d+)(?:\.(\d+))?/)
  if (!match || !match[1] || !match[2] || !match[3]) {
    return null
  }

  return {
    fullVersion: versionString,
    majorVersion: parseInt(match[1], 10),
    minorVersion: parseInt(match[2], 10),
    buildNumber: parseInt(match[3], 10),
    patchNumber: match[4] ? parseInt(match[4], 10) : 0,
  }
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
  targetPlatform: 'windows' | 'macos' | 'linux',
): UserAgentInfo {
  // Always use the actual detected browser version for the UA string.
  // BrowserOS/Nova Seller builds have their own build numbers (e.g., 7563) that
  // differ from official Chrome releases (e.g., 7313). Replacing with a known
  // Chrome version causes a mismatch: the UA says one version but browser APIs
  // expose the real build, which fingerprint detection sites flag as inconsistent.
  const chromeVersion =
    version.fullVersion ||
    `${version.majorVersion}.${version.minorVersion}.${version.buildNumber || 0}.${version.patchNumber || 0}`

  switch (targetPlatform) {
    case 'windows':
      return {
        userAgent: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`,
        appVersion: `5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`,
        platform: 'Win32',
      }
    case 'macos':
      return {
        userAgent: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`,
        appVersion: `5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`,
        platform: 'MacIntel',
      }
    case 'linux':
      return {
        userAgent: `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`,
        appVersion: `5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`,
        platform: 'Linux x86_64',
      }
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
  targetPlatform: 'windows' | 'macos' | 'linux',
): UserAgentInfo | null {
  const version = parseVersionString(versionString)
  if (!version) {
    return null
  }
  return generateUserAgent(version, targetPlatform)
}

/**
 * Generate a Firefox-format User Agent string for Zen Browser profiles.
 *
 * Zen is built on Firefox, so its UA must be Firefox-format to avoid
 * BrowserScan flagging a Chrome UA on a non-Chrome browser.
 */
export function generateFirefoxUserAgent(
  firefoxVersion: string,
  targetPlatform: 'windows' | 'macos' | 'linux',
): UserAgentInfo {
  switch (targetPlatform) {
    case 'windows':
      return {
        userAgent: `Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:${firefoxVersion}) Gecko/20100101 Firefox/${firefoxVersion}`,
        appVersion: '5.0 (Windows)',
        platform: 'Win32',
      }
    case 'macos':
      return {
        userAgent: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:${firefoxVersion}) Gecko/20100101 Firefox/${firefoxVersion}`,
        appVersion: '5.0 (Macintosh)',
        platform: 'MacIntel',
      }
    case 'linux':
      return {
        userAgent: `Mozilla/5.0 (X11; Linux x86_64; rv:${firefoxVersion}) Gecko/20100101 Firefox/${firefoxVersion}`,
        appVersion: '5.0 (X11)',
        platform: 'Linux x86_64',
      }
  }
}

/**
 * Clear the cached browser version
 * Useful when the browser is updated
 */
export function clearVersionCache(): void {
  cachedVersion = null
  cachedBrowserPath = null
}

/**
 * Get the cached browser version without re-detecting
 */
export function getCachedVersion(): BrowserVersionInfo | null {
  return cachedVersion
}
