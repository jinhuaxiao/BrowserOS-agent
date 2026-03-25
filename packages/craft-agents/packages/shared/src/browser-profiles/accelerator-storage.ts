/**
 * Accelerator Node Storage
 *
 * CRUD operations for network accelerator nodes (SS/SSH/SOCKS5).
 * Stored at ~/.craft-agent/config/accelerators.json
 */

import { randomUUID } from 'crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import * as net from 'net'
import { join } from 'path'
import { CONFIG_DIR } from '../config/paths.ts'
import type {
  AcceleratorHealthResult,
  AcceleratorNode,
  AcceleratorStatus,
  CreateAcceleratorInput,
  UpdateAcceleratorInput,
} from './types.ts'

const ACCELERATORS_FILE = join(CONFIG_DIR, 'accelerators.json')

function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true })
  }
}

function loadAccelerators(): AcceleratorNode[] {
  ensureConfigDir()
  if (!existsSync(ACCELERATORS_FILE)) return []
  try {
    return JSON.parse(
      readFileSync(ACCELERATORS_FILE, 'utf-8'),
    ) as AcceleratorNode[]
  } catch {
    return []
  }
}

function saveAccelerators(nodes: AcceleratorNode[]): void {
  ensureConfigDir()
  writeFileSync(ACCELERATORS_FILE, JSON.stringify(nodes, null, 2))
}

export function listAccelerators(): AcceleratorNode[] {
  return loadAccelerators()
}

export function getAccelerator(id: string): AcceleratorNode | null {
  return loadAccelerators().find((n) => n.id === id) || null
}

/**
 * Get the first healthy accelerator node, or the first one if none are healthy
 */
export function getDefaultAccelerator(): AcceleratorNode | null {
  const nodes = loadAccelerators()
  if (nodes.length === 0) return null
  return nodes.find((n) => n.status === 'healthy') || nodes[0]
}

export function createAccelerator(
  input: CreateAcceleratorInput,
): AcceleratorNode {
  const nodes = loadAccelerators()
  const now = Date.now()
  const node: AcceleratorNode = {
    id: randomUUID(),
    name: input.name,
    type: input.type,
    host: input.host,
    port: input.port,
    username: input.username,
    password: input.password,
    cipher: input.cipher,
    privateKeyPath: input.privateKeyPath,
    status: 'unknown',
    createdAt: now,
    updatedAt: now,
  }
  nodes.push(node)
  saveAccelerators(nodes)
  return node
}

export function updateAccelerator(
  id: string,
  input: UpdateAcceleratorInput,
): AcceleratorNode | null {
  const nodes = loadAccelerators()
  const index = nodes.findIndex((n) => n.id === id)
  if (index === -1) return null

  const updated = { ...nodes[index], ...input, updatedAt: Date.now() }
  nodes[index] = updated
  saveAccelerators(nodes)
  return updated
}

export function deleteAccelerator(id: string): boolean {
  const nodes = loadAccelerators()
  const filtered = nodes.filter((n) => n.id !== id)
  if (filtered.length === nodes.length) return false
  saveAccelerators(filtered)
  return true
}

/**
 * Check accelerator node health via TCP connection test
 */
export async function checkAcceleratorHealth(
  id: string,
): Promise<AcceleratorHealthResult> {
  const node = getAccelerator(id)
  if (!node) {
    return {
      acceleratorId: id,
      status: 'unhealthy',
      errorMessage: 'Accelerator not found',
      checkedAt: Date.now(),
    }
  }

  const start = Date.now()
  try {
    await new Promise<void>((resolve, reject) => {
      const socket = net.createConnection({ host: node.host, port: node.port })
      const timer = setTimeout(() => {
        socket.destroy()
        reject(new Error('Connection timeout'))
      }, 10000)

      socket.on('connect', () => {
        clearTimeout(timer)
        socket.destroy()
        resolve()
      })
      socket.on('error', (err) => {
        clearTimeout(timer)
        reject(err)
      })
    })

    const responseTimeMs = Date.now() - start
    const result: AcceleratorHealthResult = {
      acceleratorId: id,
      status: 'healthy',
      responseTimeMs,
      checkedAt: Date.now(),
    }

    // Update stored status
    const nodes = loadAccelerators()
    const index = nodes.findIndex((n) => n.id === id)
    if (index !== -1) {
      nodes[index].status = 'healthy'
      nodes[index].responseTimeMs = responseTimeMs
      nodes[index].lastCheckedAt = Date.now()
      nodes[index].errorMessage = undefined
      saveAccelerators(nodes)
    }

    return result
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    const result: AcceleratorHealthResult = {
      acceleratorId: id,
      status: 'unhealthy',
      errorMessage,
      checkedAt: Date.now(),
    }

    const nodes = loadAccelerators()
    const index = nodes.findIndex((n) => n.id === id)
    if (index !== -1) {
      nodes[index].status = 'unhealthy'
      nodes[index].lastCheckedAt = Date.now()
      nodes[index].errorMessage = errorMessage
      saveAccelerators(nodes)
    }

    return result
  }
}
