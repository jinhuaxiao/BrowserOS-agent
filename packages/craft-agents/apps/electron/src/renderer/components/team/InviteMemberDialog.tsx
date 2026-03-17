/**
 * InviteMemberDialog
 *
 * A dialog for creating/inviting a new team member with name, email,
 * password, and role selection.
 */

import * as React from 'react'
import type { CreateMemberInput, MemberRole } from '../../../shared/types'

interface InviteMemberDialogProps {
  organizationId: string
  open: boolean
  onClose: () => void
  onInvite: (input: CreateMemberInput) => Promise<void>
}

export function InviteMemberDialog({
  organizationId,
  open,
  onClose,
  onInvite,
}: InviteMemberDialogProps) {
  const [displayName, setDisplayName] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [role, setRole] = React.useState<MemberRole>('operator')
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [error, setError] = React.useState('')

  if (!open) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsSubmitting(true)
    try {
      await onInvite({
        organizationId,
        displayName,
        email,
        password,
        role,
      })
      setDisplayName('')
      setEmail('')
      setPassword('')
      setRole('operator')
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create member')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* biome-ignore lint/a11y/noStaticElementInteractions: backdrop dismiss */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: backdrop dismiss */}
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-xl border border-foreground/10 bg-background p-6 shadow-xl">
        <h2 className="mb-4 font-semibold text-lg">Add Team Member</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block font-medium text-sm">
              Display Name
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                className="mt-1 w-full rounded-md border border-foreground/10 bg-transparent px-3 py-2 text-sm focus:border-foreground/30 focus:outline-none"
                placeholder="John Doe"
              />
            </label>
          </div>
          <div>
            <label className="mb-1 block font-medium text-sm">
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="mt-1 w-full rounded-md border border-foreground/10 bg-transparent px-3 py-2 text-sm focus:border-foreground/30 focus:outline-none"
                placeholder="john@example.com"
              />
            </label>
          </div>
          <div>
            <label className="mb-1 block font-medium text-sm">
              Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="mt-1 w-full rounded-md border border-foreground/10 bg-transparent px-3 py-2 text-sm focus:border-foreground/30 focus:outline-none"
                placeholder="Min 6 characters"
              />
            </label>
          </div>
          <div>
            <label className="mb-1 block font-medium text-sm">
              Role
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as MemberRole)}
                className="mt-1 w-full rounded-md border border-foreground/10 bg-transparent px-3 py-2 text-sm focus:border-foreground/30 focus:outline-none"
              >
                <option value="admin">Admin</option>
                <option value="manager">Manager</option>
                <option value="operator">Operator</option>
                <option value="viewer">Viewer</option>
              </select>
            </label>
          </div>
          {error && <p className="text-destructive text-sm">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-foreground/10 px-4 py-2 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-md bg-foreground px-4 py-2 font-medium text-background text-sm disabled:opacity-50"
            >
              {isSubmitting ? 'Creating...' : 'Add Member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
