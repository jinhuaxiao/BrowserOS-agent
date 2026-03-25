/**
 * MemberProfileEditor
 *
 * Allows the current logged-in user to edit their own display name
 * and (future) password. Email and role are displayed as read-only.
 */

import { KeyRound, User } from 'lucide-react'
import * as React from 'react'
import { useTeam, useTeamSession } from '@/contexts/TeamContext'
import type { MemberRole, UpdateMemberInput } from '../../../shared/types'

const ROLE_COLORS: Record<MemberRole, string> = {
  owner: 'bg-amber-500/20 text-amber-400',
  admin: 'bg-blue-500/20 text-blue-400',
  manager: 'bg-purple-500/20 text-purple-400',
  operator: 'bg-green-500/20 text-green-400',
  viewer: 'bg-gray-500/20 text-gray-400',
}

export function MemberProfileEditor() {
  const session = useTeamSession()
  const { refreshSession } = useTeam()

  const member = session?.member
  const [displayName, setDisplayName] = React.useState(
    member?.displayName ?? '',
  )
  const [isSaving, setIsSaving] = React.useState(false)
  const [saveMessage, setSaveMessage] = React.useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)
  const [showPasswordSection, setShowPasswordSection] = React.useState(false)

  React.useEffect(() => {
    if (member?.displayName) {
      setDisplayName(member.displayName)
    }
  }, [member?.displayName])

  if (!member) {
    return (
      <div className="flex h-full items-center justify-center text-foreground/50 text-sm">
        Not logged in
      </div>
    )
  }

  const handleSaveName = async () => {
    if (displayName === member.displayName || !displayName.trim()) return
    setIsSaving(true)
    setSaveMessage(null)
    try {
      const input: UpdateMemberInput = { displayName: displayName.trim() }
      await window.electronAPI.teamUpdateMember(member.id, input)
      await refreshSession()
      setSaveMessage({ type: 'success', text: 'Display name updated' })
      setTimeout(() => setSaveMessage(null), 3000)
    } catch (err) {
      setSaveMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to update',
      })
    } finally {
      setIsSaving(false)
    }
  }

  const roleColor = ROLE_COLORS[member.role] ?? ROLE_COLORS.viewer

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-6 overflow-y-auto px-6 py-4">
        <div>
          <div className="mb-4 flex items-center gap-2">
            <User className="h-5 w-5 text-foreground/50" />
            <h2 className="font-serif font-medium text-base">My Profile</h2>
          </div>
        </div>

        {saveMessage && (
          <div
            className={`rounded-md px-3 py-2 text-sm ${
              saveMessage.type === 'success'
                ? 'bg-green-500/10 text-green-400'
                : 'bg-red-500/10 text-red-400'
            }`}
          >
            {saveMessage.text}
          </div>
        )}

        <div>
          <label className="mb-1 block font-medium text-sm">
            Display Name
            <div className="flex gap-2">
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="flex-1 rounded-md border border-border bg-transparent px-3 py-2 text-sm focus:border-foreground focus:ring-1 focus:ring-foreground focus:outline-none"
              />
              {displayName.trim() !== member.displayName &&
                displayName.trim() !== '' && (
                  <button
                    type="button"
                    onClick={handleSaveName}
                    disabled={isSaving}
                    className="rounded-md bg-foreground px-3 py-2 font-medium text-background text-sm disabled:opacity-50"
                  >
                    {isSaving ? 'Saving...' : 'Save'}
                  </button>
                )}
            </div>
          </label>
        </div>

        <div>
          <span className="mb-1 block font-medium text-sm">Email</span>
          <span className="text-foreground/50 text-sm">{member.email}</span>
        </div>

        <div>
          <span className="mb-1 block font-medium text-sm">Role</span>
          <span
            className={`inline-block rounded-full px-3 py-1 text-sm capitalize ${roleColor}`}
          >
            {member.role}
          </span>
        </div>

        <div>
          <span className="mb-1 block font-medium text-sm">Member ID</span>
          <code className="rounded bg-foreground/5 px-2 py-1 text-foreground/50 text-xs">
            {member.id}
          </code>
        </div>

        <div>
          <span className="mb-1 block font-medium text-sm">Last Login</span>
          <span className="text-foreground/50 text-sm">
            {member.lastLoginAt
              ? new Date(member.lastLoginAt).toLocaleString()
              : 'Never'}
          </span>
        </div>

        <hr className="border-border" />

        <div>
          <button
            type="button"
            onClick={() => setShowPasswordSection(!showPasswordSection)}
            className="flex items-center gap-2 font-medium text-sm text-foreground/50 hover:text-foreground"
          >
            <KeyRound className="h-4 w-4" />
            Change Password
            <span className="text-xs">{showPasswordSection ? '▲' : '▼'}</span>
          </button>

          {showPasswordSection && (
            <div className="mt-4 space-y-3 rounded-md border border-border p-4">
              <p className="text-foreground/50 text-xs italic">
                Password change is not yet available. Coming soon.
              </p>
              <div>
                <label className="mb-1 block text-sm text-foreground/50">
                  Current Password
                  <input
                    type="password"
                    disabled
                    className="mt-1 block w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm opacity-50"
                  />
                </label>
              </div>
              <div>
                <label className="mb-1 block text-sm text-foreground/50">
                  New Password
                  <input
                    type="password"
                    disabled
                    className="mt-1 block w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm opacity-50"
                  />
                </label>
              </div>
              <div>
                <label className="mb-1 block text-sm text-foreground/50">
                  Confirm New Password
                  <input
                    type="password"
                    disabled
                    className="mt-1 block w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm opacity-50"
                  />
                </label>
              </div>
              <button
                type="button"
                disabled
                className="rounded-md bg-foreground px-3 py-2 font-medium text-background text-sm opacity-50"
              >
                Update Password
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
