/**
 * gost Process Manager
 *
 * Manages gost sidecar processes for network acceleration.
 * Each profile with acceleration enabled gets its own gost process
 * that chains: local SOCKS5 -> accelerator node -> landing proxy.
 */

import { type ChildProcess, spawn } from 'node:child_process'
import * as net from 'node:net'
import { getGostBinaryPath, isGostAvailable } from './gost-binary.ts'
import type { AcceleratorNode, ProxyConfig } from './types.ts'

const gostProcesses = new Map<string, ChildProcess>()

/**
 * Build gost URI for an accelerator node
 */
function buildAcceleratorUri(node: AcceleratorNode): string {
  switch (node.type) {
    case 'ss': {
      const cipher = node.cipher || 'aes-256-gcm'
      const password = node.password || ''
      return `ss://${cipher}:${password}@${node.host}:${node.port}`
    }
    case 'ssh': {
      let auth = ''
      if (node.username && node.password) {
        auth = `${node.username}:${node.password}@`
      } else if (node.username) {
        auth = `${node.username}@`
      }
      return `ssh://${auth}${node.host}:${node.port}`
    }
    case 'socks5': {
      let auth = ''
      if (node.username && node.password) {
        auth = `${node.username}:${node.password}@`
      }
      return `socks5://${auth}${node.host}:${node.port}`
    }
    case 'http': {
      let auth = ''
      if (node.username && node.password) {
        auth = `${node.username}:${node.password}@`
      }
      return `http://${auth}${node.host}:${node.port}`
    }
  }
}

/**
 * Build gost URI for a landing proxy
 */
function buildProxyUri(proxy: ProxyConfig): string {
  let auth = ''
  if (proxy.username && proxy.password) {
    auth = `${proxy.username}:${proxy.password}@`
  }
  return `${proxy.type}://${auth}${proxy.host}:${proxy.port}`
}

/**
 * Start a gost process for a profile.
 * Creates a local SOCKS5 listener that chains through the accelerator to the landing proxy.
 *
 * Traffic flow: Chromium -> socks5://127.0.0.1:localPort -> accelerator -> landing proxy -> target
 */
export async function startGostForProfile(
  profileId: string,
  options: {
    accelerator: AcceleratorNode
    proxy: ProxyConfig
    localPort: number
  },
): Promise<{ pid: number }> {
  if (!isGostAvailable()) {
    throw new Error('gost binary not found')
  }

  // Stop existing gost if running
  stopGostForProfile(profileId)

  const binaryPath = getGostBinaryPath()!
  const { accelerator, proxy, localPort } = options

  const args = [
    '-L',
    `socks5://:${localPort}`,
    '-F',
    buildAcceleratorUri(accelerator),
    '-F',
    buildProxyUri(proxy),
  ]

  const gost = spawn(binaryPath, args, {
    detached: true,
    stdio: 'ignore',
  })
  gost.unref()

  gostProcesses.set(profileId, gost)

  gost.on('exit', () => {
    gostProcesses.delete(profileId)
  })

  gost.on('error', () => {
    gostProcesses.delete(profileId)
  })

  if (!gost.pid) {
    gostProcesses.delete(profileId)
    throw new Error('Failed to spawn gost process')
  }

  // Wait for gost to be ready
  const ready = await checkGostHealth(localPort, 5000)
  if (!ready) {
    stopGostForProfile(profileId)
    throw new Error(`gost failed to start listening on port ${localPort}`)
  }

  return { pid: gost.pid }
}

/**
 * Stop gost process for a profile
 */
export function stopGostForProfile(profileId: string): void {
  const proc = gostProcesses.get(profileId)
  if (!proc) return

  gostProcesses.delete(profileId)

  try {
    proc.kill('SIGTERM')
    // Force kill after 3 seconds
    setTimeout(() => {
      try {
        proc.kill('SIGKILL')
      } catch {
        // Already dead
      }
    }, 3000)
  } catch {
    // Already dead
  }
}

/**
 * Check if gost is running for a profile
 */
export function isGostRunning(profileId: string): boolean {
  const proc = gostProcesses.get(profileId)
  if (!proc || !proc.pid) return false

  try {
    process.kill(proc.pid, 0)
    return true
  } catch {
    gostProcesses.delete(profileId)
    return false
  }
}

/**
 * Stop all gost processes
 */
export function stopAllGost(): void {
  for (const profileId of [...gostProcesses.keys()]) {
    stopGostForProfile(profileId)
  }
}

/**
 * Check if gost local listener is ready by attempting a TCP connection
 */
export async function checkGostHealth(
  localPort: number,
  timeoutMs = 5000,
): Promise<boolean> {
  const start = Date.now()
  const retryInterval = 200

  while (Date.now() - start < timeoutMs) {
    const connected = await new Promise<boolean>((resolve) => {
      const socket = net.createConnection({
        host: '127.0.0.1',
        port: localPort,
      })
      const timer = setTimeout(() => {
        socket.destroy()
        resolve(false)
      }, 1000)

      socket.on('connect', () => {
        clearTimeout(timer)
        socket.destroy()
        resolve(true)
      })
      socket.on('error', () => {
        clearTimeout(timer)
        resolve(false)
      })
    })

    if (connected) return true

    await new Promise((r) => setTimeout(r, retryInterval))
  }

  return false
}
