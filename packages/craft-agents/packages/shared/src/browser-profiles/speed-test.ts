/**
 * Proxy Speed Test
 *
 * Compares direct proxy latency vs accelerated (gost chain) latency.
 * Uses HTTP HEAD requests to measure TTFB (Time To First Byte).
 */

import { type ChildProcess, execSync, spawn } from 'node:child_process'
import { getGostBinaryPath, isGostAvailable } from './gost-binary.ts'
import { checkGostHealth } from './gost-manager.ts'
import type {
  AcceleratorNode,
  ProxyConfig,
  ProxySpeedTestResult,
} from './types.ts'

const DEFAULT_TEST_URL = 'https://www.google.com'

/**
 * Measure HTTP latency through a SOCKS5 proxy using curl
 */
function measureLatency(
  proxyUrl: string,
  testUrl: string,
  timeoutSec = 15,
): number {
  try {
    const output = execSync(
      `curl -s -o /dev/null -w "%{time_starttransfer}" --proxy "${proxyUrl}" --max-time ${timeoutSec} "${testUrl}"`,
      { encoding: 'utf-8', timeout: (timeoutSec + 5) * 1000 },
    ).trim()
    return Math.round(parseFloat(output) * 1000)
  } catch {
    return -1
  }
}

/**
 * Build gost forward URI from accelerator node
 */
function buildAcceleratorUri(node: AcceleratorNode): string {
  switch (node.type) {
    case 'ss': {
      const cipher = node.cipher || 'aes-256-gcm'
      return `ss://${cipher}:${node.password || ''}@${node.host}:${node.port}`
    }
    case 'ssh': {
      let auth = ''
      if (node.username && node.password)
        auth = `${node.username}:${node.password}@`
      else if (node.username) auth = `${node.username}@`
      return `ssh://${auth}${node.host}:${node.port}`
    }
    case 'socks5': {
      let auth = ''
      if (node.username && node.password)
        auth = `${node.username}:${node.password}@`
      return `socks5://${auth}${node.host}:${node.port}`
    }
    case 'http': {
      let auth = ''
      if (node.username && node.password)
        auth = `${node.username}:${node.password}@`
      return `http://${auth}${node.host}:${node.port}`
    }
  }
}

function buildProxyUri(proxy: ProxyConfig): string {
  let auth = ''
  if (proxy.username && proxy.password)
    auth = `${proxy.username}:${proxy.password}@`
  return `${proxy.type}://${auth}${proxy.host}:${proxy.port}`
}

/**
 * Run speed test comparing direct proxy vs accelerated proxy
 */
export async function runSpeedTest(options: {
  proxy: ProxyConfig
  accelerator?: AcceleratorNode
  testUrl?: string
}): Promise<ProxySpeedTestResult> {
  const { proxy, accelerator, testUrl = DEFAULT_TEST_URL } = options

  // 1. Direct proxy latency
  const directProxyUrl = buildProxyUri(proxy)
  const directMs = measureLatency(directProxyUrl, testUrl)

  // 2. Accelerated latency (if accelerator provided and gost available)
  let acceleratedMs: number | undefined
  if (accelerator && isGostAvailable()) {
    // Use a random high port for temporary gost
    const tempPort = 49152 + Math.floor(Math.random() * 16000)
    const binaryPath = getGostBinaryPath()!

    const args = [
      '-L',
      `socks5://:${tempPort}`,
      '-F',
      buildAcceleratorUri(accelerator),
      '-F',
      buildProxyUri(proxy),
    ]

    let gost: ChildProcess | null = null
    try {
      gost = spawn(binaryPath, args, { detached: true, stdio: 'ignore' })
      gost.unref()

      // Wait for gost to be ready
      const ready = await checkGostHealth(tempPort, 5000)
      if (ready) {
        acceleratedMs = measureLatency(
          `socks5://127.0.0.1:${tempPort}`,
          testUrl,
        )
      }
    } finally {
      if (gost) {
        try {
          gost.kill('SIGTERM')
        } catch {}
      }
    }
  }

  return {
    directMs,
    acceleratedMs,
    testUrl,
    testedAt: Date.now(),
  }
}
