export type OrgPlan = 'free' | 'team' | 'enterprise'
export type MemberRole = 'owner' | 'admin' | 'manager' | 'operator' | 'viewer'
export type MemberStatus = 'active' | 'invited' | 'disabled'
export type AssignmentPermission = 'full' | 'launch-only' | 'view-only'
export type GroupRole = 'manager' | 'operator' | 'viewer'
export type ActivityAction =
  | 'profile.launch'
  | 'profile.stop'
  | 'profile.create'
  | 'profile.delete'
  | 'profile.update'
  | 'member.invite'
  | 'member.update'
  | 'member.disable'
  | 'member.remove'
  | 'group.create'
  | 'group.delete'
  | 'group.update'
  | 'proxy.create'
  | 'proxy.delete'
  | 'org.update'
  | 'assignment.create'
  | 'assignment.delete'
export type ActivityTargetType =
  | 'profile'
  | 'group'
  | 'member'
  | 'proxy'
  | 'org'

export interface Organization {
  id: string
  name: string
  slug: string
  ownerId: string
  plan: OrgPlan
  maxMembers: number
  maxProfiles: number
  settings: Record<string, unknown>
  createdAt: number
  updatedAt: number
}

export interface Member {
  id: string
  organizationId: string
  displayName: string
  email: string
  role: MemberRole
  status: MemberStatus
  passwordHash: string
  lastLoginAt: number | null
  createdAt: number
  updatedAt: number
}

export interface ProfileAssignment {
  id: string
  profileId: string
  memberId: string
  organizationId: string
  permissions: AssignmentPermission
  assignedBy: string
  createdAt: number
}

export interface GroupAssignment {
  id: string
  groupId: string
  memberId: string
  organizationId: string
  role: GroupRole
  createdAt: number
}

export interface ActivityLog {
  id: string
  organizationId: string
  memberId: string
  action: ActivityAction
  targetType: ActivityTargetType
  targetId: string
  metadata: Record<string, unknown>
  createdAt: number
}

export interface LoginSession {
  id: string
  memberId: string
  organizationId: string
  token: string
  expiresAt: number
  lastActiveAt: number
}

// Input types for CRUD
export interface CreateOrganizationInput {
  name: string
  slug: string
  plan?: OrgPlan
  maxMembers?: number
  maxProfiles?: number
}

export interface UpdateOrganizationInput {
  name?: string
  plan?: OrgPlan
  maxMembers?: number
  maxProfiles?: number
  settings?: Record<string, unknown>
}

export interface CreateMemberInput {
  organizationId: string
  displayName: string
  email: string
  role: MemberRole
  password: string
}

export interface UpdateMemberInput {
  displayName?: string
  email?: string
  role?: MemberRole
  status?: MemberStatus
}

export interface CreateProfileAssignmentInput {
  profileId: string
  memberId: string
  organizationId: string
  permissions: AssignmentPermission
  assignedBy: string
}

export interface CreateGroupAssignmentInput {
  groupId: string
  memberId: string
  organizationId: string
  role: GroupRole
}

export interface LoginInput {
  email: string
  password: string
  organizationSlug?: string
}

export interface LoginResult {
  success: boolean
  token?: string
  member?: Omit<Member, 'passwordHash'>
  organization?: Organization
  error?: string
}

export interface TeamSubpage {
  type: 'members' | 'roles' | 'activity-log' | 'org-settings'
}
