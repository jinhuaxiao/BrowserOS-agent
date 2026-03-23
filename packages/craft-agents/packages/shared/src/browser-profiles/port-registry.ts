/**
 * Port Registry
 *
 * Manages port allocations across concurrent browser profiles via a shared JSON file.
 * Prevents port conflicts when multiple profiles launch simultaneously.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { CONFIG_DIR } from '../config/paths.ts'

const REGISTRY_PATH = join(CONFIG_DIR, 'port-registry.json')

interface PortEntry {
  proxy: number
  cdp: number
  server: number
  extension: number
  pid: number
  updatedAt: number
}

type PortRegistry = Record<string, PortEntry>

function readRegistry(): PortRegistry {
  try {
    if (!existsSync(REGISTRY_PATH)) return {}
    const data = JSON.parse(readFileSync(REGISTRY_PATH, 'utf-8'))
    if (data && typeof data === 'object') return data as PortRegistry
  } catch {
    // Corrupted file, start fresh
  }
  return {}
}

function writeRegistry(registry: PortRegistry): void {
  const dir = CONFIG_DIR
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2))
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

/**
 * Load all registered ports, cleaning up entries for dead processes.
 */
export function loadRegisteredPorts(): Set<number> {
  const registry = readRegistry()
  const ports = new Set<number>()
  let dirty = false

  for (const [profileId, entry] of Object.entries(registry)) {
    if (entry.pid > 0 && !isProcessAlive(entry.pid)) {
      delete registry[profileId]
      dirty = true
      continue
    }
    if (entry.proxy) ports.add(entry.proxy)
    if (entry.cdp) ports.add(entry.cdp)
    if (entry.server) ports.add(entry.server)
    if (entry.extension) ports.add(entry.extension)
  }

  if (dirty) {
    try {
      writeRegistry(registry)
    } catch {
      // Best-effort cleanup
    }
  }

  return ports
}

/**
 * Register ports for a profile.
 */
export function registerProfilePorts(
  profileId: string,
  entry: PortEntry,
): void {
  const registry = readRegistry()
  registry[profileId] = { ...entry, updatedAt: Date.now() }
  try {
    writeRegistry(registry)
  } catch {
    // Best-effort
  }
}

/**
 * Unregister ports for a profile.
 */
export function unregisterProfilePorts(profileId: string): void {
  const registry = readRegistry()
  if (!(profileId in registry)) return
  delete registry[profileId]
  try {
    writeRegistry(registry)
  } catch {
    // Best-effort
  }
}
