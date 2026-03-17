/**
 * ProfileAssignmentDialog
 *
 * Allows admins/managers to assign a browser profile to team members
 * with configurable permission levels.
 */

import { Trash2, UserPlus, X } from 'lucide-react'
import * as React from 'react'
import { Button } from '@/components/ui/button'
import { useTeamSession } from '@/contexts/TeamContext'
import type {
  AssignmentPermission,
  CreateProfileAssignmentInput,
  Member,
  ProfileAssignment,
} from '../../../shared/types'

interface ProfileAssignmentDialogProps {
  profileId: string
  profileName: string
  organizationId: string
  onClose: () => void
  onAssigned: () => void
}

const PERMISSION_LABELS: Record<AssignmentPermission, string> = {
  full: 'Full Access',
  'launch-only': 'Launch Only',
  'view-only': 'View Only',
}

const PERMISSION_COLORS: Record<AssignmentPermission, string> = {
  full: '#FF9900',
  'launch-only': '#007185',
  'view-only': '#565959',
}

export function ProfileAssignmentDialog({
  profileId,
  profileName,
  organizationId,
  onClose,
  onAssigned,
}: ProfileAssignmentDialogProps) {
  const session = useTeamSession()
  const currentMemberId = session?.member.id ?? ''

  const [assignments, setAssignments] = React.useState<ProfileAssignment[]>([])
  const [members, setMembers] = React.useState<Omit<Member, 'passwordHash'>[]>(
    [],
  )
  const [selectedMemberId, setSelectedMemberId] = React.useState('')
  const [selectedPermission, setSelectedPermission] =
    React.useState<AssignmentPermission>('launch-only')
  const [isLoading, setIsLoading] = React.useState(true)
  const [isAdding, setIsAdding] = React.useState(false)
  const [error, setError] = React.useState('')

  const loadData = React.useCallback(async () => {
    try {
      const [assignmentList, memberList] = await Promise.all([
        window.electronAPI.teamListProfileAssignments(organizationId, {
          profileId,
        }),
        window.electronAPI.teamListMembers(organizationId),
      ])
      setAssignments(assignmentList)
      setMembers(memberList)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setIsLoading(false)
    }
  }, [organizationId, profileId])

  React.useEffect(() => {
    loadData()
  }, [loadData])

  const assignedMemberIds = new Set(assignments.map((a) => a.memberId))
  const availableMembers = members.filter((m) => !assignedMemberIds.has(m.id))

  const getMemberName = (memberId: string): string => {
    const member = members.find((m) => m.id === memberId)
    return member?.displayName ?? 'Unknown'
  }

  const handleAdd = async () => {
    if (!selectedMemberId) return
    setError('')
    setIsAdding(true)
    try {
      const input: CreateProfileAssignmentInput = {
        profileId,
        memberId: selectedMemberId,
        organizationId,
        permissions: selectedPermission,
        assignedBy: currentMemberId,
      }
      await window.electronAPI.teamCreateProfileAssignment(input)
      setSelectedMemberId('')
      setSelectedPermission('launch-only')
      await loadData()
      onAssigned()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add assignment')
    } finally {
      setIsAdding(false)
    }
  }

  const handleRemove = async (assignmentId: string) => {
    setError('')
    try {
      await window.electronAPI.teamDeleteProfileAssignment(assignmentId)
      await loadData()
      onAssigned()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to remove assignment',
      )
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* biome-ignore lint/a11y/noStaticElementInteractions: backdrop dismiss */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: backdrop dismiss */}
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div
        className="relative z-10 w-full max-w-lg rounded-lg bg-white shadow-xl"
        style={{ color: '#0F1111' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between border-b px-5 py-4"
          style={{ borderColor: '#D5D9D9' }}
        >
          <div>
            <h2
              className="text-base font-semibold"
              style={{ color: '#0F1111' }}
            >
              Profile Assignments
            </h2>
            <p className="mt-0.5 text-sm" style={{ color: '#565959' }}>
              {profileName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 transition-colors hover:bg-gray-100"
          >
            <X size={18} style={{ color: '#565959' }} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4">
          {isLoading ? (
            <p
              className="py-8 text-center text-sm"
              style={{ color: '#565959' }}
            >
              Loading...
            </p>
          ) : (
            <>
              {/* Current Assignments */}
              <div className="mb-5">
                <h3
                  className="mb-2 text-xs font-semibold uppercase tracking-wide"
                  style={{ color: '#565959' }}
                >
                  Current Assignments ({assignments.length})
                </h3>
                {assignments.length === 0 ? (
                  <p
                    className="rounded-md border py-6 text-center text-sm"
                    style={{ borderColor: '#D5D9D9', color: '#565959' }}
                  >
                    No members assigned to this profile yet.
                  </p>
                ) : (
                  <div
                    className="divide-y rounded-md border"
                    style={{ borderColor: '#D5D9D9' }}
                  >
                    {assignments.map((assignment) => (
                      <div
                        key={assignment.id}
                        className="flex items-center justify-between px-3 py-2.5"
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className="text-sm font-medium"
                            style={{ color: '#0F1111' }}
                          >
                            {getMemberName(assignment.memberId)}
                          </span>
                          <span
                            className="rounded-full px-2 py-0.5 text-xs font-medium text-white"
                            style={{
                              backgroundColor:
                                PERMISSION_COLORS[assignment.permissions],
                            }}
                          >
                            {PERMISSION_LABELS[assignment.permissions]}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemove(assignment.id)}
                          className="rounded p-1 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add Assignment */}
              <div>
                <h3
                  className="mb-2 text-xs font-semibold uppercase tracking-wide"
                  style={{ color: '#565959' }}
                >
                  Add Assignment
                </h3>
                {availableMembers.length === 0 ? (
                  <p className="text-sm" style={{ color: '#565959' }}>
                    All members are already assigned to this profile.
                  </p>
                ) : (
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <label
                        className="mb-1 block text-xs font-medium"
                        style={{ color: '#565959' }}
                      >
                        Member
                      </label>
                      <select
                        value={selectedMemberId}
                        onChange={(e) => setSelectedMemberId(e.target.value)}
                        className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none"
                        style={{
                          borderColor: '#D5D9D9',
                          color: '#0F1111',
                        }}
                      >
                        <option value="">Select a member...</option>
                        {availableMembers.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.displayName} ({m.email})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="w-36">
                      <label
                        className="mb-1 block text-xs font-medium"
                        style={{ color: '#565959' }}
                      >
                        Permission
                      </label>
                      <select
                        value={selectedPermission}
                        onChange={(e) =>
                          setSelectedPermission(
                            e.target.value as AssignmentPermission,
                          )
                        }
                        className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none"
                        style={{
                          borderColor: '#D5D9D9',
                          color: '#0F1111',
                        }}
                      >
                        <option value="full">Full Access</option>
                        <option value="launch-only">Launch Only</option>
                        <option value="view-only">View Only</option>
                      </select>
                    </div>
                    <Button
                      onClick={handleAdd}
                      disabled={!selectedMemberId || isAdding}
                      className="flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                      style={{ backgroundColor: '#FF9900' }}
                    >
                      <UserPlus size={14} />
                      {isAdding ? 'Adding...' : 'Add'}
                    </Button>
                  </div>
                )}
              </div>

              {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
