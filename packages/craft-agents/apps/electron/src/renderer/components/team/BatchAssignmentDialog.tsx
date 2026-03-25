/**
 * BatchAssignmentDialog
 *
 * Allows batch assignment of multiple profiles to one member,
 * or multiple members to one profile.
 */

import { CheckSquare, X } from 'lucide-react'
import * as React from 'react'
import { Button } from '@/components/ui/button'
import { useTeamSession } from '@/contexts/TeamContext'
import type {
  AssignmentPermission,
  BrowserProfileConfig,
  CreateProfileAssignmentInput,
  Member,
  ProfileAssignment,
} from '../../../shared/types'

interface BatchAssignmentDialogProps {
  mode: 'profiles-to-member' | 'members-to-profile'
  targetMemberId?: string
  targetMemberName?: string
  targetProfileId?: string
  targetProfileName?: string
  organizationId: string
  onClose: () => void
  onAssigned: () => void
}

const PERMISSION_LABELS: Record<AssignmentPermission, string> = {
  full: 'Full Access',
  'launch-only': 'Launch Only',
  'view-only': 'View Only',
}

export function BatchAssignmentDialog({
  mode,
  targetMemberId,
  targetMemberName,
  targetProfileId,
  targetProfileName,
  organizationId,
  onClose,
  onAssigned,
}: BatchAssignmentDialogProps) {
  const session = useTeamSession()
  const currentMemberId = session?.member.id ?? ''

  const [profiles, setProfiles] = React.useState<BrowserProfileConfig[]>([])
  const [members, setMembers] = React.useState<Omit<Member, 'passwordHash'>[]>(
    [],
  )
  const [assignments, setAssignments] = React.useState<ProfileAssignment[]>([])
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())
  const [permission, setPermission] =
    React.useState<AssignmentPermission>('launch-only')
  const [isLoading, setIsLoading] = React.useState(true)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [error, setError] = React.useState('')
  const [searchQuery, setSearchQuery] = React.useState('')

  const assignedIds = React.useMemo(() => {
    if (mode === 'profiles-to-member') {
      return new Set(assignments.map((a) => a.profileId))
    }
    return new Set(assignments.map((a) => a.memberId))
  }, [assignments, mode])

  const loadData = React.useCallback(async () => {
    try {
      if (mode === 'profiles-to-member' && targetMemberId) {
        const [profileList, assignmentList] = await Promise.all([
          window.electronAPI.listBrowserProfiles(),
          window.electronAPI.teamListProfileAssignments(organizationId, {
            memberId: targetMemberId,
          }),
        ])
        setProfiles(profileList)
        setAssignments(assignmentList)
      } else if (mode === 'members-to-profile' && targetProfileId) {
        const [memberList, assignmentList] = await Promise.all([
          window.electronAPI.teamListMembers(organizationId),
          window.electronAPI.teamListProfileAssignments(organizationId, {
            profileId: targetProfileId,
          }),
        ])
        setMembers(memberList)
        setAssignments(assignmentList)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setIsLoading(false)
    }
  }, [organizationId, mode, targetMemberId, targetProfileId])

  React.useEffect(() => {
    loadData()
  }, [loadData])

  const items = React.useMemo(() => {
    if (mode === 'profiles-to-member') {
      return profiles.map((p) => ({
        id: p.id,
        label: p.name,
        sublabel: p.group || '',
        isAssigned: assignedIds.has(p.id),
      }))
    }
    return members.map((m) => ({
      id: m.id,
      label: m.displayName,
      sublabel: m.email,
      isAssigned: assignedIds.has(m.id),
    }))
  }, [mode, profiles, members, assignedIds])

  const filteredItems = React.useMemo(() => {
    if (!searchQuery.trim()) return items
    const q = searchQuery.toLowerCase()
    return items.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.sublabel.toLowerCase().includes(q),
    )
  }, [items, searchQuery])

  const selectableCount = filteredItems.filter((i) => !i.isAssigned).length
  const selectedCount = selectedIds.size

  const toggleItem = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const toggleAll = () => {
    const selectableItems = filteredItems.filter((i) => !i.isAssigned)
    const allSelected = selectableItems.every((i) => selectedIds.has(i.id))
    if (allSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        for (const item of selectableItems) next.delete(item.id)
        return next
      })
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        for (const item of selectableItems) next.add(item.id)
        return next
      })
    }
  }

  const handleSubmit = async () => {
    if (selectedIds.size === 0) return
    setError('')
    setIsSubmitting(true)
    try {
      const promises: Promise<unknown>[] = []
      for (const id of selectedIds) {
        const input: CreateProfileAssignmentInput = {
          profileId: mode === 'profiles-to-member' ? id : targetProfileId!,
          memberId: mode === 'members-to-profile' ? id : targetMemberId!,
          organizationId,
          permissions: permission,
          assignedBy: currentMemberId,
        }
        promises.push(window.electronAPI.teamCreateProfileAssignment(input))
      }
      await Promise.all(promises)
      setSelectedIds(new Set())
      await loadData()
      onAssigned()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to create assignments',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const title =
    mode === 'profiles-to-member'
      ? `Assign Profiles to ${targetMemberName ?? 'Member'}`
      : `Assign Members to ${targetProfileName ?? 'Profile'}`

  const subtitle =
    mode === 'profiles-to-member'
      ? 'Select profiles to assign'
      : 'Select members to assign'

  const itemLabel = mode === 'profiles-to-member' ? 'profiles' : 'members'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* biome-ignore lint/a11y/noStaticElementInteractions: backdrop dismiss */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: backdrop dismiss */}
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div
        className="relative z-10 flex w-full max-w-lg flex-col rounded-lg bg-white shadow-xl"
        style={{ color: '#0F1111', maxHeight: '80vh' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between border-b px-5 py-4"
          style={{ borderColor: '#D5D9D9' }}
        >
          <div>
            <h2
              className="text-base font-serif font-medium"
              style={{ color: '#0F1111' }}
            >
              {title}
            </h2>
            <p className="mt-0.5 text-sm" style={{ color: '#565959' }}>
              {subtitle}
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
        <div className="flex-1 overflow-hidden px-5 py-4">
          {isLoading ? (
            <p
              className="py-8 text-center text-sm"
              style={{ color: '#565959' }}
            >
              Loading...
            </p>
          ) : (
            <>
              {/* Search */}
              <input
                type="text"
                placeholder={`Search ${itemLabel}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="mb-3 w-full rounded-md border px-3 py-2 text-sm focus:outline-none"
                style={{ borderColor: '#D5D9D9', color: '#0F1111' }}
              />

              {/* Select all toggle */}
              {selectableCount > 0 && (
                <div className="mb-2 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={toggleAll}
                    className="text-xs font-medium hover:underline"
                    style={{ color: '#007185' }}
                  >
                    {filteredItems
                      .filter((i) => !i.isAssigned)
                      .every((i) => selectedIds.has(i.id))
                      ? 'Deselect All'
                      : 'Select All'}
                  </button>
                  <span className="text-xs" style={{ color: '#565959' }}>
                    {selectedCount} selected
                  </span>
                </div>
              )}

              {/* Checkbox list */}
              <div
                className="divide-y overflow-y-auto rounded-md border"
                style={{ borderColor: '#D5D9D9', maxHeight: '280px' }}
              >
                {filteredItems.length === 0 ? (
                  <p
                    className="py-6 text-center text-sm"
                    style={{ color: '#565959' }}
                  >
                    {searchQuery
                      ? `No ${itemLabel} match your search.`
                      : `No ${itemLabel} available.`}
                  </p>
                ) : (
                  filteredItems.map((item) => {
                    const isChecked =
                      item.isAssigned || selectedIds.has(item.id)
                    const isDisabled = item.isAssigned
                    return (
                      <label
                        key={item.id}
                        className="flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors hover:bg-gray-50"
                        style={{
                          opacity: isDisabled ? 0.55 : 1,
                          cursor: isDisabled ? 'default' : 'pointer',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={isDisabled}
                          onChange={() => !isDisabled && toggleItem(item.id)}
                          className="h-4 w-4 rounded border-gray-300"
                          style={{ accentColor: '#FF9900' }}
                        />
                        <div className="min-w-0 flex-1">
                          <span
                            className="block truncate text-sm font-medium"
                            style={{ color: '#0F1111' }}
                          >
                            {item.label}
                          </span>
                          {item.sublabel && (
                            <span
                              className="block truncate text-xs"
                              style={{ color: '#565959' }}
                            >
                              {item.sublabel}
                            </span>
                          )}
                        </div>
                        {item.isAssigned && (
                          <span
                            className="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium"
                            style={{
                              backgroundColor: '#F0F0F0',
                              color: '#565959',
                            }}
                          >
                            Assigned
                          </span>
                        )}
                      </label>
                    )
                  })
                )}
              </div>

              {/* Permission selector */}
              {selectableCount > 0 && (
                <div className="mt-4">
                  <label
                    className="mb-1 block text-xs font-medium"
                    style={{ color: '#565959' }}
                  >
                    Permission for new assignments
                  </label>
                  <select
                    value={permission}
                    onChange={(e) =>
                      setPermission(e.target.value as AssignmentPermission)
                    }
                    className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none"
                    style={{ borderColor: '#D5D9D9', color: '#0F1111' }}
                  >
                    {(
                      Object.entries(PERMISSION_LABELS) as [
                        AssignmentPermission,
                        string,
                      ][]
                    ).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
            </>
          )}
        </div>

        {/* Footer */}
        {!isLoading && selectableCount > 0 && (
          <div
            className="flex items-center justify-end gap-3 border-t px-5 py-3"
            style={{ borderColor: '#D5D9D9' }}
          >
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-gray-50"
              style={{ borderColor: '#D5D9D9', color: '#0F1111' }}
            >
              Cancel
            </button>
            <Button
              onClick={handleSubmit}
              disabled={selectedCount === 0 || isSubmitting}
              className="flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              style={{ backgroundColor: '#FF9900' }}
            >
              <CheckSquare size={14} />
              {isSubmitting
                ? 'Assigning...'
                : `Assign Selected (${selectedCount})`}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
