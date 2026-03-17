/**
 * MemberDetail
 *
 * Shows detail view for a selected member: name, email, role, status,
 * last login, and a danger zone for removal.
 */

import { Clock, Shield, UserCog } from 'lucide-react'
import * as React from 'react'
import { cn } from '@/lib/utils'
import type {
  Member,
  MemberRole,
  UpdateMemberInput,
} from '../../../shared/types'

const ROLE_OPTIONS: {
  value: MemberRole
  label: string
  description: string
}[] = [
  {
    value: 'owner',
    label: 'Owner',
    description: 'Full control over everything',
  },
  {
    value: 'admin',
    label: 'Admin',
    description: 'Manage members, profiles, and proxies',
  },
  {
    value: 'manager',
    label: 'Manager',
    description: 'Manage assigned groups and profiles',
  },
  {
    value: 'operator',
    label: 'Operator',
    description: 'Launch and use assigned profiles',
  },
  {
    value: 'viewer',
    label: 'Viewer',
    description: 'View-only access to assigned profiles',
  },
]

interface MemberDetailProps {
  member: Omit<Member, 'passwordHash'>
  onUpdateMember: (memberId: string, input: UpdateMemberInput) => Promise<void>
  onDeleteMember: (memberId: string) => Promise<void>
  canEdit: boolean
}

export function MemberDetail({
  member,
  onUpdateMember,
  onDeleteMember,
  canEdit,
}: MemberDetailProps) {
  const [isEditing, setIsEditing] = React.useState(false)
  const [editRole, setEditRole] = React.useState<MemberRole>(member.role)

  React.useEffect(() => {
    setEditRole(member.role)
    setIsEditing(false)
  }, [member.role])

  const handleSaveRole = async () => {
    if (editRole !== member.role) {
      await onUpdateMember(member.id, { role: editRole })
    }
    setIsEditing(false)
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-foreground/5 border-b px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-foreground/10 font-medium text-lg">
            {member.displayName.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="font-semibold text-base">{member.displayName}</h2>
            <p className="text-muted-foreground text-xs">{member.email}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto px-6 py-4">
        {/* Role */}
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-sm">Role</span>
          </div>
          {isEditing && canEdit ? (
            <div className="space-y-2">
              {ROLE_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={cn(
                    'flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors',
                    editRole === opt.value
                      ? 'border-foreground/20 bg-foreground/5'
                      : 'border-foreground/10 hover:bg-foreground/[0.02]',
                  )}
                >
                  <input
                    type="radio"
                    name="role"
                    value={opt.value}
                    checked={editRole === opt.value}
                    onChange={() => setEditRole(opt.value)}
                    className="mt-0.5"
                  />
                  <div>
                    <div className="font-medium text-sm">{opt.label}</div>
                    <div className="text-muted-foreground text-xs">
                      {opt.description}
                    </div>
                  </div>
                </label>
              ))}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleSaveRole}
                  className="rounded-md bg-foreground px-3 py-1.5 font-medium text-background text-xs"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditRole(member.role)
                    setIsEditing(false)
                  }}
                  className="rounded-md border border-foreground/10 px-3 py-1.5 text-xs"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm capitalize">{member.role}</span>
              {canEdit && member.role !== 'owner' && (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="text-muted-foreground text-xs hover:text-foreground"
                >
                  Change
                </button>
              )}
            </div>
          )}
        </div>

        {/* Status */}
        <div>
          <div className="mb-2 flex items-center gap-2">
            <UserCog className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-sm">Status</span>
          </div>
          <span
            className={cn(
              'inline-block rounded-full px-2 py-0.5 font-medium text-xs',
              member.status === 'active'
                ? 'bg-green-500/15 text-green-600'
                : member.status === 'invited'
                  ? 'bg-yellow-500/15 text-yellow-600'
                  : 'bg-red-500/15 text-red-600',
            )}
          >
            {member.status}
          </span>
        </div>

        {/* Last Login */}
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-sm">Last Login</span>
          </div>
          <span className="text-muted-foreground text-sm">
            {member.lastLoginAt
              ? new Date(member.lastLoginAt).toLocaleString()
              : 'Never'}
          </span>
        </div>

        {/* Danger zone */}
        {canEdit && member.role !== 'owner' && (
          <div className="border-foreground/5 border-t pt-6">
            <h3 className="mb-2 font-medium text-destructive text-sm">
              Danger Zone
            </h3>
            <button
              type="button"
              onClick={() => onDeleteMember(member.id)}
              className="rounded-md border border-destructive/30 px-3 py-1.5 text-destructive text-xs hover:bg-destructive/10"
            >
              Remove Member
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
