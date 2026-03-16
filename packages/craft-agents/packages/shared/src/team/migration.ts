/**
 * Auto-migration for existing single-user installations
 *
 * On first startup when no organization exists:
 * 1. Creates a "Personal" organization
 * 2. Creates an owner member with a default password
 * 3. Auto-logs in as the owner (skips login for single-user mode)
 */

import { randomBytes, randomUUID, scryptSync } from 'node:crypto'
import {
  createLoginSession,
  createMemberWithHash,
  createOrganization,
  getDatabase,
  hasAnyOrganization,
} from './database'
import type { LoginSession, Member, Organization } from './types'

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

export interface MigrationResult {
  migrated: boolean
  organization?: Organization
  member?: Member
  loginSession?: LoginSession
}

/**
 * Check if migration is needed and perform it if so.
 * Returns the auto-created session token for single-user mode.
 */
export function migrateIfNeeded(): MigrationResult {
  if (hasAnyOrganization()) {
    return { migrated: false }
  }

  const defaultPassword = 'admin'
  const passwordHash = hashPassword(defaultPassword)

  // Create org with placeholder ownerId
  const org = createOrganization(
    {
      name: 'Personal',
      slug: 'personal',
      plan: 'free',
      maxMembers: 5,
      maxProfiles: 100,
    },
    'pending',
  )

  const member = createMemberWithHash(
    org.id,
    'Admin',
    'admin@local',
    'owner',
    passwordHash,
  )

  // Update org owner via direct SQL (updateOrganization doesn't support ownerId change)
  const db = getDatabase()
  db.prepare('UPDATE organizations SET owner_id = ? WHERE id = ?').run(
    member.id,
    org.id,
  )

  // Create auto-login session (long-lived: 365 days)
  const token = randomUUID()
  const session = createLoginSession(
    member.id,
    org.id,
    token,
    365 * 24 * 60 * 60 * 1000,
  )

  return {
    migrated: true,
    organization: { ...org, ownerId: member.id },
    member,
    loginSession: session,
  }
}
