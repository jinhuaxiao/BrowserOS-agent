import type { MemberRole } from '../../shared/types'
import { useTeam } from '../contexts/TeamContext'

interface PermissionsResult {
  currentRole: MemberRole | null
  currentMemberId: string | null
  currentOrgId: string | null

  canManageMembers: boolean
  canCreateProfile: boolean
  canDeleteProfile: boolean
  canLaunchProfile: (
    profileId: string,
    assignedProfileIds?: string[],
  ) => boolean
  canViewProfile: (profileId: string, assignedProfileIds?: string[]) => boolean
  canManageGroups: boolean
  canAssignProfiles: boolean
  canManageProxies: boolean
  canViewActivityLog: boolean
  canManageOrgSettings: boolean

  isOwner: boolean
  isAdmin: boolean
  isManager: boolean
  isOperator: boolean
  isViewer: boolean
}

export function usePermissions(): PermissionsResult {
  const { session, isLoading } = useTeam()
  const role = session?.member?.role ?? null
  const memberId = session?.member?.id ?? null
  const orgId = session?.organization?.id ?? null

  // When no session exists (still loading, or single-user mode without login),
  // grant full permissions to maintain backward compatibility
  const noSession = !session && !isLoading

  const isOwner = role === 'owner' || noSession
  const isAdmin = role === 'admin'
  const isManager = role === 'manager'
  const isOperator = role === 'operator'
  const isViewer = role === 'viewer'

  const isAdminOrAbove = isOwner || isAdmin
  const isManagerOrAbove = isAdminOrAbove || isManager

  return {
    currentRole: role,
    currentMemberId: memberId,
    currentOrgId: orgId,

    canManageMembers: isAdminOrAbove,
    canCreateProfile: isManagerOrAbove,
    canDeleteProfile: isManagerOrAbove,
    canLaunchProfile: (_profileId: string, assignedProfileIds?: string[]) => {
      if (isManagerOrAbove) return true
      if (isOperator && assignedProfileIds) {
        return assignedProfileIds.includes(_profileId)
      }
      return false
    },
    canViewProfile: (_profileId: string, assignedProfileIds?: string[]) => {
      if (isManagerOrAbove) return true
      if ((isOperator || isViewer) && assignedProfileIds) {
        return assignedProfileIds.includes(_profileId)
      }
      return false
    },
    canManageGroups: isManagerOrAbove,
    canAssignProfiles: isManagerOrAbove,
    canManageProxies: isAdminOrAbove,
    canViewActivityLog: isManagerOrAbove,
    canManageOrgSettings: isOwner,

    isOwner,
    isAdmin,
    isManager,
    isOperator,
    isViewer,
  }
}
