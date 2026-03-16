import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import type {
  ActivityAction,
  ActivityLog,
  ActivityTargetType,
  CreateGroupAssignmentInput,
  CreateOrganizationInput,
  CreateProfileAssignmentInput,
  GroupAssignment,
  LoginSession,
  Member,
  Organization,
  ProfileAssignment,
  UpdateMemberInput,
  UpdateOrganizationInput,
} from './types'

const DB_DIR = join(homedir(), '.craft-agent')
const DB_PATH = join(DB_DIR, 'craft-agent.db')

let db: Database.Database | null = null

export function getDatabase(): Database.Database {
  if (db) return db
  if (!existsSync(DB_DIR)) {
    mkdirSync(DB_DIR, { recursive: true })
  }
  db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  initializeSchema(db)
  return db
}

export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
  }
}

function initializeSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      owner_id TEXT NOT NULL,
      plan TEXT NOT NULL DEFAULT 'free',
      max_members INTEGER NOT NULL DEFAULT 5,
      max_profiles INTEGER NOT NULL DEFAULT 100,
      settings TEXT NOT NULL DEFAULT '{}',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS members (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      display_name TEXT NOT NULL,
      email TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'operator',
      status TEXT NOT NULL DEFAULT 'active',
      password_hash TEXT NOT NULL,
      last_login_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
      UNIQUE(organization_id, email)
    );

    CREATE TABLE IF NOT EXISTS login_sessions (
      id TEXT PRIMARY KEY,
      member_id TEXT NOT NULL,
      organization_id TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expires_at INTEGER NOT NULL,
      last_active_at INTEGER NOT NULL,
      FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS profile_assignments (
      id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL,
      member_id TEXT NOT NULL,
      organization_id TEXT NOT NULL,
      permissions TEXT NOT NULL DEFAULT 'full',
      assigned_by TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
      UNIQUE(profile_id, member_id)
    );

    CREATE TABLE IF NOT EXISTS group_assignments (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL,
      member_id TEXT NOT NULL,
      organization_id TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'operator',
      created_at INTEGER NOT NULL,
      FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
      UNIQUE(group_id, member_id)
    );

    CREATE TABLE IF NOT EXISTS activity_logs (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      member_id TEXT NOT NULL,
      action TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      metadata TEXT NOT NULL DEFAULT '{}',
      created_at INTEGER NOT NULL,
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_members_org ON members(organization_id);
    CREATE INDEX IF NOT EXISTS idx_members_email ON members(organization_id, email);
    CREATE INDEX IF NOT EXISTS idx_login_sessions_token ON login_sessions(token);
    CREATE INDEX IF NOT EXISTS idx_login_sessions_member ON login_sessions(member_id);
    CREATE INDEX IF NOT EXISTS idx_profile_assignments_member ON profile_assignments(member_id);
    CREATE INDEX IF NOT EXISTS idx_profile_assignments_profile ON profile_assignments(profile_id);
    CREATE INDEX IF NOT EXISTS idx_group_assignments_member ON group_assignments(member_id);
    CREATE INDEX IF NOT EXISTS idx_group_assignments_group ON group_assignments(group_id);
    CREATE INDEX IF NOT EXISTS idx_activity_logs_org ON activity_logs(organization_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_activity_logs_member ON activity_logs(member_id, created_at);
  `)
}

// --- Row mappers (snake_case DB -> camelCase TS) ---

function mapOrganizationRow(row: Record<string, unknown>): Organization {
  return {
    id: row.id as string,
    name: row.name as string,
    slug: row.slug as string,
    ownerId: row.owner_id as string,
    plan: row.plan as Organization['plan'],
    maxMembers: row.max_members as number,
    maxProfiles: row.max_profiles as number,
    settings: JSON.parse(row.settings as string),
    createdAt: row.created_at as number,
    updatedAt: row.updated_at as number,
  }
}

function mapMemberRow(row: Record<string, unknown>): Member {
  return {
    id: row.id as string,
    organizationId: row.organization_id as string,
    displayName: row.display_name as string,
    email: row.email as string,
    role: row.role as Member['role'],
    status: row.status as Member['status'],
    passwordHash: row.password_hash as string,
    lastLoginAt: row.last_login_at as number | null,
    createdAt: row.created_at as number,
    updatedAt: row.updated_at as number,
  }
}

function mapLoginSessionRow(row: Record<string, unknown>): LoginSession {
  return {
    id: row.id as string,
    memberId: row.member_id as string,
    organizationId: row.organization_id as string,
    token: row.token as string,
    expiresAt: row.expires_at as number,
    lastActiveAt: row.last_active_at as number,
  }
}

function mapProfileAssignmentRow(
  row: Record<string, unknown>,
): ProfileAssignment {
  return {
    id: row.id as string,
    profileId: row.profile_id as string,
    memberId: row.member_id as string,
    organizationId: row.organization_id as string,
    permissions: row.permissions as ProfileAssignment['permissions'],
    assignedBy: row.assigned_by as string,
    createdAt: row.created_at as number,
  }
}

function mapGroupAssignmentRow(row: Record<string, unknown>): GroupAssignment {
  return {
    id: row.id as string,
    groupId: row.group_id as string,
    memberId: row.member_id as string,
    organizationId: row.organization_id as string,
    role: row.role as GroupAssignment['role'],
    createdAt: row.created_at as number,
  }
}

function mapActivityLogRow(row: Record<string, unknown>): ActivityLog {
  return {
    id: row.id as string,
    organizationId: row.organization_id as string,
    memberId: row.member_id as string,
    action: row.action as ActivityLog['action'],
    targetType: row.target_type as ActivityLog['targetType'],
    targetId: row.target_id as string,
    metadata: JSON.parse(row.metadata as string),
    createdAt: row.created_at as number,
  }
}

// --- Organization CRUD ---

export function createOrganization(
  input: CreateOrganizationInput,
  ownerId: string,
): Organization {
  const db = getDatabase()
  const now = Date.now()
  const id = randomUUID()

  const stmt = db.prepare(`
    INSERT INTO organizations (id, name, slug, owner_id, plan, max_members, max_profiles, settings, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  stmt.run(
    id,
    input.name,
    input.slug,
    ownerId,
    input.plan ?? 'free',
    input.maxMembers ?? 5,
    input.maxProfiles ?? 100,
    JSON.stringify({}),
    now,
    now,
  )

  return getOrganization(id)!
}

export function getOrganization(id: string): Organization | null {
  const db = getDatabase()
  const row = db.prepare('SELECT * FROM organizations WHERE id = ?').get(id) as
    | Record<string, unknown>
    | undefined
  return row ? mapOrganizationRow(row) : null
}

export function getOrganizationBySlug(slug: string): Organization | null {
  const db = getDatabase()
  const row = db
    .prepare('SELECT * FROM organizations WHERE slug = ?')
    .get(slug) as Record<string, unknown> | undefined
  return row ? mapOrganizationRow(row) : null
}

export function listOrganizations(): Organization[] {
  const db = getDatabase()
  const rows = db
    .prepare('SELECT * FROM organizations ORDER BY created_at DESC')
    .all() as Record<string, unknown>[]
  return rows.map(mapOrganizationRow)
}

export function updateOrganization(
  id: string,
  input: UpdateOrganizationInput,
): Organization | null {
  const db = getDatabase()
  const existing = getOrganization(id)
  if (!existing) return null

  const fields: string[] = []
  const values: unknown[] = []

  if (input.name !== undefined) {
    fields.push('name = ?')
    values.push(input.name)
  }
  if (input.plan !== undefined) {
    fields.push('plan = ?')
    values.push(input.plan)
  }
  if (input.maxMembers !== undefined) {
    fields.push('max_members = ?')
    values.push(input.maxMembers)
  }
  if (input.maxProfiles !== undefined) {
    fields.push('max_profiles = ?')
    values.push(input.maxProfiles)
  }
  if (input.settings !== undefined) {
    fields.push('settings = ?')
    values.push(JSON.stringify(input.settings))
  }

  if (fields.length === 0) return existing

  fields.push('updated_at = ?')
  values.push(Date.now())
  values.push(id)

  db.prepare(`UPDATE organizations SET ${fields.join(', ')} WHERE id = ?`).run(
    ...values,
  )

  return getOrganization(id)
}

// --- Member CRUD ---

export function createMemberWithHash(
  orgId: string,
  displayName: string,
  email: string,
  role: Member['role'],
  passwordHash: string,
): Member {
  const db = getDatabase()
  const now = Date.now()
  const id = randomUUID()

  db.prepare(`
    INSERT INTO members (id, organization_id, display_name, email, role, status, password_hash, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?)
  `).run(id, orgId, displayName, email, role, passwordHash, now, now)

  return getMember(id)!
}

export function getMember(id: string): Member | null {
  const db = getDatabase()
  const row = db.prepare('SELECT * FROM members WHERE id = ?').get(id) as
    | Record<string, unknown>
    | undefined
  return row ? mapMemberRow(row) : null
}

export function getMemberByEmail(orgId: string, email: string): Member | null {
  const db = getDatabase()
  const row = db
    .prepare('SELECT * FROM members WHERE organization_id = ? AND email = ?')
    .get(orgId, email) as Record<string, unknown> | undefined
  return row ? mapMemberRow(row) : null
}

export function listMembers(orgId: string): Member[] {
  const db = getDatabase()
  const rows = db
    .prepare(
      'SELECT * FROM members WHERE organization_id = ? ORDER BY created_at ASC',
    )
    .all(orgId) as Record<string, unknown>[]
  return rows.map(mapMemberRow)
}

export function updateMember(
  id: string,
  input: UpdateMemberInput,
): Member | null {
  const db = getDatabase()
  const existing = getMember(id)
  if (!existing) return null

  const fields: string[] = []
  const values: unknown[] = []

  if (input.displayName !== undefined) {
    fields.push('display_name = ?')
    values.push(input.displayName)
  }
  if (input.email !== undefined) {
    fields.push('email = ?')
    values.push(input.email)
  }
  if (input.role !== undefined) {
    fields.push('role = ?')
    values.push(input.role)
  }
  if (input.status !== undefined) {
    fields.push('status = ?')
    values.push(input.status)
  }

  if (fields.length === 0) return existing

  fields.push('updated_at = ?')
  values.push(Date.now())
  values.push(id)

  db.prepare(`UPDATE members SET ${fields.join(', ')} WHERE id = ?`).run(
    ...values,
  )

  return getMember(id)
}

export function deleteMember(id: string): boolean {
  const db = getDatabase()
  const result = db.prepare('DELETE FROM members WHERE id = ?').run(id)
  return result.changes > 0
}

export function updateMemberLastLogin(id: string): void {
  const db = getDatabase()
  db.prepare(
    'UPDATE members SET last_login_at = ?, updated_at = ? WHERE id = ?',
  ).run(Date.now(), Date.now(), id)
}

// --- LoginSession CRUD ---

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

export function createLoginSession(
  memberId: string,
  orgId: string,
  token: string,
  expiresInMs: number = THIRTY_DAYS_MS,
): LoginSession {
  const db = getDatabase()
  const now = Date.now()
  const id = randomUUID()

  db.prepare(`
    INSERT INTO login_sessions (id, member_id, organization_id, token, expires_at, last_active_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, memberId, orgId, token, now + expiresInMs, now)

  return getLoginSessionById(id)!
}

function getLoginSessionById(id: string): LoginSession | null {
  const db = getDatabase()
  const row = db.prepare('SELECT * FROM login_sessions WHERE id = ?').get(id) as
    | Record<string, unknown>
    | undefined
  return row ? mapLoginSessionRow(row) : null
}

export function getLoginSessionByToken(token: string): LoginSession | null {
  const db = getDatabase()
  const row = db
    .prepare('SELECT * FROM login_sessions WHERE token = ?')
    .get(token) as Record<string, unknown> | undefined
  return row ? mapLoginSessionRow(row) : null
}

export function deleteLoginSession(id: string): boolean {
  const db = getDatabase()
  const result = db.prepare('DELETE FROM login_sessions WHERE id = ?').run(id)
  return result.changes > 0
}

export function deleteExpiredSessions(): number {
  const db = getDatabase()
  const result = db
    .prepare('DELETE FROM login_sessions WHERE expires_at < ?')
    .run(Date.now())
  return result.changes
}

export function updateSessionActivity(id: string): void {
  const db = getDatabase()
  db.prepare('UPDATE login_sessions SET last_active_at = ? WHERE id = ?').run(
    Date.now(),
    id,
  )
}

// --- ProfileAssignment CRUD ---

export function createProfileAssignment(
  input: CreateProfileAssignmentInput,
): ProfileAssignment {
  const db = getDatabase()
  const now = Date.now()
  const id = randomUUID()

  db.prepare(`
    INSERT INTO profile_assignments (id, profile_id, member_id, organization_id, permissions, assigned_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    input.profileId,
    input.memberId,
    input.organizationId,
    input.permissions ?? 'full',
    input.assignedBy,
    now,
  )

  return getProfileAssignmentById(id)!
}

function getProfileAssignmentById(id: string): ProfileAssignment | null {
  const db = getDatabase()
  const row = db
    .prepare('SELECT * FROM profile_assignments WHERE id = ?')
    .get(id) as Record<string, unknown> | undefined
  return row ? mapProfileAssignmentRow(row) : null
}

export function deleteProfileAssignment(id: string): boolean {
  const db = getDatabase()
  const result = db
    .prepare('DELETE FROM profile_assignments WHERE id = ?')
    .run(id)
  return result.changes > 0
}

export function listProfileAssignments(
  orgId: string,
  filters?: { memberId?: string; profileId?: string },
): ProfileAssignment[] {
  const db = getDatabase()
  let sql = 'SELECT * FROM profile_assignments WHERE organization_id = ?'
  const params: unknown[] = [orgId]

  if (filters?.memberId) {
    sql += ' AND member_id = ?'
    params.push(filters.memberId)
  }
  if (filters?.profileId) {
    sql += ' AND profile_id = ?'
    params.push(filters.profileId)
  }

  sql += ' ORDER BY created_at DESC'

  const rows = db.prepare(sql).all(...params) as Record<string, unknown>[]
  return rows.map(mapProfileAssignmentRow)
}

export function getProfileAssignment(
  profileId: string,
  memberId: string,
): ProfileAssignment | null {
  const db = getDatabase()
  const row = db
    .prepare(
      'SELECT * FROM profile_assignments WHERE profile_id = ? AND member_id = ?',
    )
    .get(profileId, memberId) as Record<string, unknown> | undefined
  return row ? mapProfileAssignmentRow(row) : null
}

// --- GroupAssignment CRUD ---

export function createGroupAssignment(
  input: CreateGroupAssignmentInput,
): GroupAssignment {
  const db = getDatabase()
  const now = Date.now()
  const id = randomUUID()

  db.prepare(`
    INSERT INTO group_assignments (id, group_id, member_id, organization_id, role, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    id,
    input.groupId,
    input.memberId,
    input.organizationId,
    input.role ?? 'operator',
    now,
  )

  return getGroupAssignmentById(id)!
}

function getGroupAssignmentById(id: string): GroupAssignment | null {
  const db = getDatabase()
  const row = db
    .prepare('SELECT * FROM group_assignments WHERE id = ?')
    .get(id) as Record<string, unknown> | undefined
  return row ? mapGroupAssignmentRow(row) : null
}

export function deleteGroupAssignment(id: string): boolean {
  const db = getDatabase()
  const result = db
    .prepare('DELETE FROM group_assignments WHERE id = ?')
    .run(id)
  return result.changes > 0
}

export function listGroupAssignments(
  orgId: string,
  filters?: { memberId?: string; groupId?: string },
): GroupAssignment[] {
  const db = getDatabase()
  let sql = 'SELECT * FROM group_assignments WHERE organization_id = ?'
  const params: unknown[] = [orgId]

  if (filters?.memberId) {
    sql += ' AND member_id = ?'
    params.push(filters.memberId)
  }
  if (filters?.groupId) {
    sql += ' AND group_id = ?'
    params.push(filters.groupId)
  }

  sql += ' ORDER BY created_at DESC'

  const rows = db.prepare(sql).all(...params) as Record<string, unknown>[]
  return rows.map(mapGroupAssignmentRow)
}

// --- ActivityLog ---

export function logActivity(
  orgId: string,
  memberId: string,
  action: ActivityAction,
  targetType: ActivityTargetType,
  targetId: string,
  metadata?: Record<string, unknown>,
): ActivityLog {
  const db = getDatabase()
  const now = Date.now()
  const id = randomUUID()

  db.prepare(`
    INSERT INTO activity_logs (id, organization_id, member_id, action, target_type, target_id, metadata, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    orgId,
    memberId,
    action,
    targetType,
    targetId,
    JSON.stringify(metadata ?? {}),
    now,
  )

  return getActivityLogById(id)!
}

function getActivityLogById(id: string): ActivityLog | null {
  const db = getDatabase()
  const row = db.prepare('SELECT * FROM activity_logs WHERE id = ?').get(id) as
    | Record<string, unknown>
    | undefined
  return row ? mapActivityLogRow(row) : null
}

export function listActivityLogs(
  orgId: string,
  filters?: {
    memberId?: string
    action?: string
    limit?: number
    offset?: number
  },
): ActivityLog[] {
  const db = getDatabase()
  let sql = 'SELECT * FROM activity_logs WHERE organization_id = ?'
  const params: unknown[] = [orgId]

  if (filters?.memberId) {
    sql += ' AND member_id = ?'
    params.push(filters.memberId)
  }
  if (filters?.action) {
    sql += ' AND action = ?'
    params.push(filters.action)
  }

  sql += ' ORDER BY created_at DESC'

  const limit = filters?.limit ?? 100
  const offset = filters?.offset ?? 0
  sql += ' LIMIT ? OFFSET ?'
  params.push(limit, offset)

  const rows = db.prepare(sql).all(...params) as Record<string, unknown>[]
  return rows.map(mapActivityLogRow)
}

// --- Setup check ---

export function hasAnyOrganization(): boolean {
  const db = getDatabase()
  const row = db.prepare('SELECT 1 FROM organizations LIMIT 1').get()
  return row !== undefined
}
