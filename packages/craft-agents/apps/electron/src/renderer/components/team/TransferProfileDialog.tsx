/**
 * TransferProfileDialog
 *
 * Allows admins/managers to transfer a browser profile's assignment
 * from one member to another.
 */

import { ArrowRightLeft, X } from 'lucide-react'
import * as React from 'react'
import { Button } from '@/components/ui/button'
import { useTeamSession } from '@/contexts/TeamContext'
import type {
  AssignmentPermission,
  CreateProfileAssignmentInput,
  Member,
} from '../../../shared/types'

interface TransferProfileDialogProps {
  profileId: string
  profileName: string
  organizationId: string
  currentAssignmentId: string
  currentMemberName: string
  onClose: () => void
  onTransferred: () => void
}

const PERMISSION_LABELS: Record<AssignmentPermission, string> = {
  full: 'Full Access',
  'launch-only': 'Launch Only',
  'view-only': 'View Only',
}

export function TransferProfileDialog({
  profileId,
  profileName,
  organizationId,
  currentAssignmentId,
  currentMemberName,
  onClose,
  onTransferred,
}: TransferProfileDialogProps) {
  const session = useTeamSession()
  const currentMemberId = session?.member.id ?? ''

  const [members, setMembers] = React.useState<Omit<Member, 'passwordHash'>[]>(
    [],
  )
  const [selectedMemberId, setSelectedMemberId] = React.useState('')
  const [selectedPermission, setSelectedPermission] =
    React.useState<AssignmentPermission>('launch-only')
  const [isLoading, setIsLoading] = React.useState(true)
  const [isTransferring, setIsTransferring] = React.useState(false)
  const [error, setError] = React.useState('')

  React.useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const memberList =
          await window.electronAPI.teamListMembers(organizationId)
        if (!cancelled) setMembers(memberList)
      } catch (err) {
        if (!cancelled)
          setError(
            err instanceof Error ? err.message : 'Failed to load members',
          )
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [organizationId])

  const availableMembers = members.filter(
    (m) => m.displayName !== currentMemberName,
  )

  const handleTransfer = async () => {
    if (!selectedMemberId) return
    setError('')
    setIsTransferring(true)
    try {
      await window.electronAPI.teamDeleteProfileAssignment(currentAssignmentId)

      const input: CreateProfileAssignmentInput = {
        profileId,
        memberId: selectedMemberId,
        organizationId,
        permissions: selectedPermission,
        assignedBy: currentMemberId,
      }
      await window.electronAPI.teamCreateProfileAssignment(input)
      onTransferred()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to transfer assignment',
      )
    } finally {
      setIsTransferring(false)
    }
  }

  const selectedMember = members.find((m) => m.id === selectedMemberId)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* biome-ignore lint/a11y/noStaticElementInteractions: backdrop dismiss */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: backdrop dismiss */}
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div
        className="relative z-10 w-full max-w-md rounded-lg bg-white shadow-xl"
        style={{ color: '#0F1111' }}
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
              Transfer Profile
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
              {/* Current Assignment */}
              <div className="mb-5">
                <h3
                  className="mb-2 text-xs font-serif font-medium uppercase tracking-wide"
                  style={{ color: '#565959' }}
                >
                  Currently Assigned To
                </h3>
                <div
                  className="rounded-md border px-3 py-2.5"
                  style={{ borderColor: '#D5D9D9', backgroundColor: '#F7F8F8' }}
                >
                  <span
                    className="text-sm font-medium"
                    style={{ color: '#0F1111' }}
                  >
                    {currentMemberName}
                  </span>
                </div>
              </div>

              {/* Transfer To */}
              <div className="mb-4">
                <h3
                  className="mb-2 text-xs font-serif font-medium uppercase tracking-wide"
                  style={{ color: '#565959' }}
                >
                  Transfer To
                </h3>
                {availableMembers.length === 0 ? (
                  <p className="text-sm" style={{ color: '#565959' }}>
                    No other members available to transfer to.
                  </p>
                ) : (
                  <div className="space-y-3">
                    <div>
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
                    <div>
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
                        <option value="full">{PERMISSION_LABELS.full}</option>
                        <option value="launch-only">
                          {PERMISSION_LABELS['launch-only']}
                        </option>
                        <option value="view-only">
                          {PERMISSION_LABELS['view-only']}
                        </option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Transfer Summary */}
              {selectedMemberId && selectedMember && (
                <div
                  className="mb-4 rounded-md border px-3 py-2.5"
                  style={{ borderColor: '#D5D9D9', backgroundColor: '#FFF8EF' }}
                >
                  <p className="text-sm" style={{ color: '#0F1111' }}>
                    <span className="font-medium">{currentMemberName}</span>
                    <span style={{ color: '#565959' }}>
                      {' '}
                      will lose access,{' '}
                    </span>
                    <span className="font-medium">
                      {selectedMember.displayName}
                    </span>
                    <span style={{ color: '#565959' }}>
                      {' '}
                      will receive{' '}
                      {PERMISSION_LABELS[selectedPermission].toLowerCase()}.
                    </span>
                  </p>
                </div>
              )}

              {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

              {/* Actions */}
              <div className="flex justify-end gap-2">
                <Button
                  onClick={onClose}
                  variant="outline"
                  className="rounded-md px-4 py-2 text-sm font-medium"
                  style={{ borderColor: '#D5D9D9', color: '#0F1111' }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleTransfer}
                  disabled={!selectedMemberId || isTransferring}
                  className="flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                  style={{ backgroundColor: '#FF9900' }}
                >
                  <ArrowRightLeft size={14} />
                  {isTransferring ? 'Transferring...' : 'Transfer'}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
