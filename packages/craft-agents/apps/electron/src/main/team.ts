/**
 * Team Management IPC Handlers
 *
 * Handles IPC calls for team/organization management, authentication,
 * and profile/group assignments.
 */

import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import {
  createGroupAssignment,
  createLoginSession,
  createMemberWithHash,
  createOrganization,
  createProfileAssignment,
  deleteGroupAssignment,
  deleteLoginSession,
  deleteMember,
  deleteProfileAssignment,
  getLatestValidLoginSession,
  getLoginSessionByToken,
  getMember,
  getMemberByEmail,
  getOrganization,
  hasAnyOrganization,
  initDatabaseEngine,
  listActivityLogs,
  listGroupAssignments,
  listMembers,
  listOrganizations,
  listProfileAssignments,
  logActivity,
  migrateIfNeeded,
  updateMember,
  updateMemberLastLogin,
  updateOrganization,
} from '@craft-agent/shared/team'
import type {
  CreateGroupAssignmentInput,
  CreateOrganizationInput,
  CreateProfileAssignmentInput,
  LoginInput,
  LoginResult,
  Member,
  UpdateMemberInput,
  UpdateOrganizationInput,
} from '@craft-agent/shared/team/types'
import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../shared/types'
import { ipcLog } from './logger'

// --- Password hashing with scrypt ---

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, hash] = storedHash.split(':')
  const hashBuffer = Buffer.from(hash, 'hex')
  const derivedHash = scryptSync(password, salt, 64)
  return timingSafeEqual(hashBuffer, derivedHash)
}

// --- Session token management ---

let currentSessionToken: string | null = null

export function setCurrentSessionToken(token: string | null): void {
  currentSessionToken = token
}

export function getCurrentSessionToken(): string | null {
  return currentSessionToken
}

// --- Helper to strip passwordHash from member ---

function stripPasswordHash(member: Member): Omit<Member, 'passwordHash'> {
  const { passwordHash, ...rest } = member
  return rest
}

/**
 * Register team management IPC handlers
 */
export async function registerTeamHandlers(): Promise<void> {
  await initDatabaseEngine()

  // Run migration on startup - creates "Personal" org for first-time users
  try {
    const migrationResult = migrateIfNeeded()
    if (migrationResult.migrated) {
      ipcLog.info(
        'Auto-migrated: created Personal organization for single-user mode',
      )
      if (migrationResult.loginSession) {
        currentSessionToken = migrationResult.loginSession.token
      }
    }
  } catch (error) {
    ipcLog.error('Migration check failed:', error)
  }

  // Restore session from database if not set by migration
  if (!currentSessionToken) {
    try {
      const session = getLatestValidLoginSession()
      if (session) {
        currentSessionToken = session.token
        ipcLog.info('Restored session from database')
      }
    } catch (error) {
      ipcLog.error('Failed to restore session:', error)
    }
  }

  // ============================================================================
  // Setup & Auth Handlers
  // ============================================================================

  ipcMain.handle(IPC_CHANNELS.TEAM_SETUP_CHECK, async () => {
    try {
      const hasOrgs = hasAnyOrganization()
      return { needsSetup: !hasOrgs, hasOrgs }
    } catch (error) {
      ipcLog.error('Failed to check team setup:', error)
      throw error
    }
  })

  ipcMain.handle(
    IPC_CHANNELS.TEAM_SETUP_ORG,
    async (
      _event,
      input: {
        name: string
        slug: string
        adminName: string
        adminEmail: string
        adminPassword: string
      },
    ) => {
      try {
        const passwordHash = hashPassword(input.adminPassword)
        const org = createOrganization(
          { name: input.name, slug: input.slug },
          'pending',
        )

        const member = createMemberWithHash(
          org.id,
          input.adminName,
          input.adminEmail,
          'owner',
          passwordHash,
        )

        // Update org owner to the created member
        updateOrganization(org.id, {} as UpdateOrganizationInput)
        // Patch owner_id directly since updateOrganization doesn't expose it
        // We set ownerId at creation time by passing member.id, but since member
        // doesn't exist yet, we create with 'pending' and update after
        const { getDatabase } = await import('@craft-agent/shared/team')
        const db = getDatabase()
        db.prepare('UPDATE organizations SET owner_id = ? WHERE id = ?').run(
          member.id,
          org.id,
        )

        const token = randomBytes(32).toString('hex')
        const _session = createLoginSession(member.id, org.id, token)
        currentSessionToken = token
        updateMemberLastLogin(member.id)

        ipcLog.info(
          `Team setup complete: org=${org.name}, admin=${member.email}`,
        )

        return {
          success: true,
          token,
          member: stripPasswordHash(member),
          organization: getOrganization(org.id) ?? undefined,
        } satisfies LoginResult
      } catch (error) {
        ipcLog.error('Failed to setup team:', error)
        throw error
      }
    },
  )

  ipcMain.handle(IPC_CHANNELS.TEAM_LOGIN, async (_event, input: LoginInput) => {
    try {
      const orgs = listOrganizations()
      if (orgs.length === 0) {
        return {
          success: false,
          error: 'No organization exists',
        } satisfies LoginResult
      }

      // Find org by slug or use first org
      const org = input.organizationSlug
        ? orgs.find((o) => o.slug === input.organizationSlug)
        : orgs[0]

      if (!org) {
        return {
          success: false,
          error: 'Organization not found',
        } satisfies LoginResult
      }

      const member = getMemberByEmail(org.id, input.email)
      if (!member) {
        return {
          success: false,
          error: 'Invalid email or password',
        } satisfies LoginResult
      }

      if (member.status !== 'active') {
        return {
          success: false,
          error: 'Account is disabled',
        } satisfies LoginResult
      }

      const valid = verifyPassword(input.password, member.passwordHash)
      if (!valid) {
        return {
          success: false,
          error: 'Invalid email or password',
        } satisfies LoginResult
      }

      const token = randomBytes(32).toString('hex')
      createLoginSession(member.id, org.id, token)
      currentSessionToken = token
      updateMemberLastLogin(member.id)

      ipcLog.info(`Team login: ${member.email} -> ${org.name}`)

      return {
        success: true,
        token,
        member: stripPasswordHash(member),
        organization: org,
      } satisfies LoginResult
    } catch (error) {
      ipcLog.error('Failed to login:', error)
      throw error
    }
  })

  ipcMain.handle(IPC_CHANNELS.TEAM_LOGOUT, async () => {
    try {
      if (currentSessionToken) {
        const session = getLoginSessionByToken(currentSessionToken)
        if (session) {
          deleteLoginSession(session.id)
        }
        currentSessionToken = null
      }
      ipcLog.info('Team logout')
      return true
    } catch (error) {
      ipcLog.error('Failed to logout:', error)
      throw error
    }
  })

  ipcMain.handle(IPC_CHANNELS.TEAM_GET_SESSION, async () => {
    try {
      if (!currentSessionToken) return null

      const session = getLoginSessionByToken(currentSessionToken)
      if (!session) {
        currentSessionToken = null
        return null
      }

      if (session.expiresAt < Date.now()) {
        deleteLoginSession(session.id)
        currentSessionToken = null
        return null
      }

      const member = getMember(session.memberId)
      if (!member) {
        deleteLoginSession(session.id)
        currentSessionToken = null
        return null
      }

      const org = getOrganization(session.organizationId)

      return {
        session,
        member: stripPasswordHash(member),
        organization: org,
      }
    } catch (error) {
      ipcLog.error('Failed to get session:', error)
      throw error
    }
  })

  // ============================================================================
  // Organization Handlers
  // ============================================================================

  ipcMain.handle(IPC_CHANNELS.TEAM_ORG_LIST, async () => {
    try {
      return listOrganizations()
    } catch (error) {
      ipcLog.error('Failed to list organizations:', error)
      throw error
    }
  })

  ipcMain.handle(
    IPC_CHANNELS.TEAM_ORG_CREATE,
    async (_event, input: CreateOrganizationInput, ownerId: string) => {
      try {
        const org = createOrganization(input, ownerId)
        ipcLog.info(`Created organization: ${org.name} (${org.id})`)
        return org
      } catch (error) {
        ipcLog.error('Failed to create organization:', error)
        throw error
      }
    },
  )

  ipcMain.handle(
    IPC_CHANNELS.TEAM_ORG_UPDATE,
    async (_event, orgId: string, input: UpdateOrganizationInput) => {
      try {
        const org = updateOrganization(orgId, input)
        if (org) {
          ipcLog.info(`Updated organization: ${org.name} (${org.id})`)
        }
        return org
      } catch (error) {
        ipcLog.error(`Failed to update organization ${orgId}:`, error)
        throw error
      }
    },
  )

  ipcMain.handle(IPC_CHANNELS.TEAM_ORG_GET, async (_event, orgId: string) => {
    try {
      return getOrganization(orgId)
    } catch (error) {
      ipcLog.error(`Failed to get organization ${orgId}:`, error)
      throw error
    }
  })

  // ============================================================================
  // Member Handlers
  // ============================================================================

  ipcMain.handle(
    IPC_CHANNELS.TEAM_MEMBER_LIST,
    async (_event, orgId: string) => {
      try {
        const members = listMembers(orgId)
        return members.map(stripPasswordHash)
      } catch (error) {
        ipcLog.error(`Failed to list members for org ${orgId}:`, error)
        throw error
      }
    },
  )

  ipcMain.handle(
    IPC_CHANNELS.TEAM_MEMBER_CREATE,
    async (
      _event,
      input: {
        organizationId: string
        displayName: string
        email: string
        role: Member['role']
        password: string
      },
    ) => {
      try {
        const passwordHash = hashPassword(input.password)
        const member = createMemberWithHash(
          input.organizationId,
          input.displayName,
          input.email,
          input.role,
          passwordHash,
        )
        ipcLog.info(
          `Created member: ${member.email} (${member.id}) in org ${input.organizationId}`,
        )
        return stripPasswordHash(member)
      } catch (error) {
        ipcLog.error('Failed to create member:', error)
        throw error
      }
    },
  )

  ipcMain.handle(
    IPC_CHANNELS.TEAM_MEMBER_UPDATE,
    async (_event, memberId: string, input: UpdateMemberInput) => {
      try {
        const member = updateMember(memberId, input)
        if (member) {
          ipcLog.info(`Updated member: ${member.email} (${member.id})`)
          return stripPasswordHash(member)
        }
        return null
      } catch (error) {
        ipcLog.error(`Failed to update member ${memberId}:`, error)
        throw error
      }
    },
  )

  ipcMain.handle(
    IPC_CHANNELS.TEAM_MEMBER_DELETE,
    async (_event, memberId: string) => {
      try {
        const deleted = deleteMember(memberId)
        if (deleted) {
          ipcLog.info(`Deleted member: ${memberId}`)
        }
        return deleted
      } catch (error) {
        ipcLog.error(`Failed to delete member ${memberId}:`, error)
        throw error
      }
    },
  )

  ipcMain.handle(
    IPC_CHANNELS.TEAM_MEMBER_GET,
    async (_event, memberId: string) => {
      try {
        const member = getMember(memberId)
        return member ? stripPasswordHash(member) : null
      } catch (error) {
        ipcLog.error(`Failed to get member ${memberId}:`, error)
        throw error
      }
    },
  )

  // ============================================================================
  // Profile Assignment Handlers
  // ============================================================================

  ipcMain.handle(
    IPC_CHANNELS.TEAM_PROFILE_ASSIGNMENT_LIST,
    async (
      _event,
      orgId: string,
      filters?: { memberId?: string; profileId?: string },
    ) => {
      try {
        return listProfileAssignments(orgId, filters)
      } catch (error) {
        ipcLog.error('Failed to list profile assignments:', error)
        throw error
      }
    },
  )

  ipcMain.handle(
    IPC_CHANNELS.TEAM_PROFILE_ASSIGNMENT_CREATE,
    async (_event, input: CreateProfileAssignmentInput) => {
      try {
        const assignment = createProfileAssignment(input)
        logActivity(
          input.organizationId,
          input.assignedBy,
          'assignment.create',
          'profile',
          input.profileId,
          { memberId: input.memberId, permissions: input.permissions },
        )
        ipcLog.info(
          `Created profile assignment: profile=${input.profileId} -> member=${input.memberId}`,
        )
        return assignment
      } catch (error) {
        ipcLog.error('Failed to create profile assignment:', error)
        throw error
      }
    },
  )

  ipcMain.handle(
    IPC_CHANNELS.TEAM_PROFILE_ASSIGNMENT_DELETE,
    async (
      _event,
      assignmentId: string,
      context: { orgId: string; memberId: string },
    ) => {
      try {
        const deleted = deleteProfileAssignment(assignmentId)
        if (deleted) {
          logActivity(
            context.orgId,
            context.memberId,
            'assignment.delete',
            'profile',
            assignmentId,
          )
          ipcLog.info(`Deleted profile assignment: ${assignmentId}`)
        }
        return deleted
      } catch (error) {
        ipcLog.error(
          `Failed to delete profile assignment ${assignmentId}:`,
          error,
        )
        throw error
      }
    },
  )

  // ============================================================================
  // Group Assignment Handlers
  // ============================================================================

  ipcMain.handle(
    IPC_CHANNELS.TEAM_GROUP_ASSIGNMENT_LIST,
    async (
      _event,
      orgId: string,
      filters?: { memberId?: string; groupId?: string },
    ) => {
      try {
        return listGroupAssignments(orgId, filters)
      } catch (error) {
        ipcLog.error('Failed to list group assignments:', error)
        throw error
      }
    },
  )

  ipcMain.handle(
    IPC_CHANNELS.TEAM_GROUP_ASSIGNMENT_CREATE,
    async (
      _event,
      input: CreateGroupAssignmentInput,
      context: { actorMemberId: string },
    ) => {
      try {
        const assignment = createGroupAssignment(input)
        logActivity(
          input.organizationId,
          context.actorMemberId,
          'assignment.create',
          'group',
          input.groupId,
          { memberId: input.memberId, role: input.role },
        )
        ipcLog.info(
          `Created group assignment: group=${input.groupId} -> member=${input.memberId}`,
        )
        return assignment
      } catch (error) {
        ipcLog.error('Failed to create group assignment:', error)
        throw error
      }
    },
  )

  ipcMain.handle(
    IPC_CHANNELS.TEAM_GROUP_ASSIGNMENT_DELETE,
    async (
      _event,
      assignmentId: string,
      context: { orgId: string; memberId: string },
    ) => {
      try {
        const deleted = deleteGroupAssignment(assignmentId)
        if (deleted) {
          logActivity(
            context.orgId,
            context.memberId,
            'assignment.delete',
            'group',
            assignmentId,
          )
          ipcLog.info(`Deleted group assignment: ${assignmentId}`)
        }
        return deleted
      } catch (error) {
        ipcLog.error(
          `Failed to delete group assignment ${assignmentId}:`,
          error,
        )
        throw error
      }
    },
  )

  // ============================================================================
  // Activity Log Handlers
  // ============================================================================

  ipcMain.handle(
    IPC_CHANNELS.TEAM_ACTIVITY_LOG_LIST,
    async (
      _event,
      orgId: string,
      filters?: {
        memberId?: string
        action?: string
        limit?: number
        offset?: number
      },
    ) => {
      try {
        return listActivityLogs(orgId, filters)
      } catch (error) {
        ipcLog.error('Failed to list activity logs:', error)
        throw error
      }
    },
  )

  ipcLog.info('Team management IPC handlers registered')
}
