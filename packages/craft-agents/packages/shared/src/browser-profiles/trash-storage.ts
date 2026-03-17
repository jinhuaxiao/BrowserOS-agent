/**
 * Trash Storage
 *
 * Soft delete with 30-day auto-cleanup for browser profiles.
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'
import {
  getProfilePath,
  getProfilesBaseDir,
  loadProfileConfig,
} from './storage'

export interface TrashItem {
  profileId: string
  profileName: string
  deletedAt: number
  autoDeleteAt: number
  originalGroupId?: string
  profileConfig: Record<string, unknown>
}

interface TrashIndex {
  items: TrashItem[]
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

function getTrashDir(): string {
  return join(getProfilesBaseDir(), 'trash')
}

function getTrashIndexPath(): string {
  return join(getTrashDir(), 'trash-index.json')
}

function ensureTrashDir(): void {
  const dir = getTrashDir()
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}

function loadTrashIndex(): TrashIndex {
  const indexPath = getTrashIndexPath()
  if (!existsSync(indexPath)) {
    return { items: [] }
  }
  try {
    return JSON.parse(readFileSync(indexPath, 'utf-8')) as TrashIndex
  } catch {
    return { items: [] }
  }
}

function saveTrashIndex(index: TrashIndex): void {
  ensureTrashDir()
  writeFileSync(getTrashIndexPath(), JSON.stringify(index, null, 2))
}

export function softDeleteProfile(profileId: string): boolean {
  const profileDir = getProfilePath(profileId)
  if (!existsSync(profileDir)) return false

  const config = loadProfileConfig(profileId)
  if (!config) return false

  ensureTrashDir()

  const now = Date.now()
  const trashItem: TrashItem = {
    profileId,
    profileName: config.name,
    deletedAt: now,
    autoDeleteAt: now + THIRTY_DAYS_MS,
    originalGroupId: config.groupId,
    profileConfig: config as unknown as Record<string, unknown>,
  }

  // Move profile directory to trash
  const trashProfileDir = join(getTrashDir(), profileId)
  renameSync(profileDir, trashProfileDir)

  // Update index
  const index = loadTrashIndex()
  index.items = index.items.filter((item) => item.profileId !== profileId)
  index.items.push(trashItem)
  saveTrashIndex(index)

  return true
}

export function restoreProfile(profileId: string): boolean {
  const index = loadTrashIndex()
  const item = index.items.find((i) => i.profileId === profileId)
  if (!item) return false

  const trashProfileDir = join(getTrashDir(), profileId)
  if (!existsSync(trashProfileDir)) return false

  const originalDir = getProfilePath(profileId)

  // If original location exists (name collision), fail gracefully
  if (existsSync(originalDir)) return false

  // Move back to original location
  renameSync(trashProfileDir, originalDir)

  // Remove from index
  index.items = index.items.filter((i) => i.profileId !== profileId)
  saveTrashIndex(index)

  return true
}

export function permanentDeleteProfile(profileId: string): boolean {
  const index = loadTrashIndex()
  const item = index.items.find((i) => i.profileId === profileId)
  if (!item) return false

  const trashProfileDir = join(getTrashDir(), profileId)
  if (existsSync(trashProfileDir)) {
    rmSync(trashProfileDir, { recursive: true })
  }

  index.items = index.items.filter((i) => i.profileId !== profileId)
  saveTrashIndex(index)

  return true
}

export function listTrashItems(): TrashItem[] {
  const index = loadTrashIndex()
  return index.items.sort((a, b) => b.deletedAt - a.deletedAt)
}

export function getTrashCount(): number {
  return loadTrashIndex().items.length
}

export function emptyTrash(): number {
  const index = loadTrashIndex()
  const count = index.items.length

  for (const item of index.items) {
    const trashProfileDir = join(getTrashDir(), item.profileId)
    if (existsSync(trashProfileDir)) {
      rmSync(trashProfileDir, { recursive: true })
    }
  }

  saveTrashIndex({ items: [] })
  return count
}

export function autoCleanupTrash(): number {
  const index = loadTrashIndex()
  const now = Date.now()
  const expired = index.items.filter((item) => item.autoDeleteAt <= now)

  if (expired.length === 0) return 0

  for (const item of expired) {
    const trashProfileDir = join(getTrashDir(), item.profileId)
    if (existsSync(trashProfileDir)) {
      rmSync(trashProfileDir, { recursive: true })
    }
  }

  index.items = index.items.filter((item) => item.autoDeleteAt > now)
  saveTrashIndex(index)
  return expired.length
}
