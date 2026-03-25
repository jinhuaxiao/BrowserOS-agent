/**
 * gost Binary Management
 *
 * Locates and validates the gost binary for chain proxy support.
 * gost is bundled as a sidecar binary (single Go executable).
 */

import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { arch, platform } from 'node:os'
import { join } from 'node:path'

function getPlatformArch(): string {
  const p = platform()
  const a = arch()
  const platformMap: Record<string, string> = {
    darwin: 'darwin',
    linux: 'linux',
    win32: 'windows',
  }
  const archMap: Record<string, string> = {
    arm64: 'arm64',
    x64: 'amd64',
  }
  return `${platformMap[p] || p}-${archMap[a] || a}`
}

function getBinaryName(): string {
  return platform() === 'win32' ? 'gost.exe' : 'gost'
}

/**
 * Resolve the gost binary path.
 * Search order:
 * 1. Electron packaged resources (process.resourcesPath/bin/gost)
 * 2. Development resources (packages/craft-agents/resources/bin/{platform}-{arch}/gost)
 * 3. System PATH (which gost)
 */
export function getGostBinaryPath(): string | null {
  const binary = getBinaryName()

  // 1. Packaged Electron app
  if (process.resourcesPath) {
    const packaged = join(process.resourcesPath, 'bin', binary)
    if (existsSync(packaged)) return packaged
  }

  // 2. Development: relative to this file's package
  const devPath = join(
    __dirname,
    '..',
    '..',
    '..',
    '..', // shared/src/browser-profiles -> craft-agents
    'resources',
    'bin',
    getPlatformArch(),
    binary,
  )
  if (existsSync(devPath)) return devPath

  // 3. System PATH
  try {
    const systemPath = execSync(`which ${binary}`, { encoding: 'utf-8' }).trim()
    if (systemPath && existsSync(systemPath)) return systemPath
  } catch {
    // Not on PATH
  }

  return null
}

/**
 * Check if gost binary is available
 */
export function isGostAvailable(): boolean {
  return getGostBinaryPath() !== null
}

/**
 * Get gost version string
 */
export function getGostVersion(): string | null {
  const binaryPath = getGostBinaryPath()
  if (!binaryPath) return null

  try {
    const output = execSync(`"${binaryPath}" -V`, {
      encoding: 'utf-8',
      timeout: 5000,
    }).trim()
    return output
  } catch {
    return null
  }
}
