/**
 * MemberList
 *
 * Shows a list of organization members with role badges and status indicators.
 * Includes an "Add Member" button in the header.
 */

import { UserPlus } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Member, MemberRole } from '../../../shared/types'

const ROLE_COLORS: Record<MemberRole, string> = {
  owner: 'bg-amber-500/15 text-amber-600',
  admin: 'bg-purple-500/15 text-purple-600',
  manager: 'bg-blue-500/15 text-blue-600',
  operator: 'bg-green-500/15 text-green-600',
  viewer: 'bg-gray-500/15 text-gray-600',
}

interface MemberListProps {
  members: Omit<Member, 'passwordHash'>[]
  onSelectMember: (memberId: string) => void
  onInviteMember: () => void
  selectedMemberId?: string
}

export function MemberList({
  members,
  onSelectMember,
  onInviteMember,
  selectedMemberId,
}: MemberListProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-foreground/5 border-b px-4 py-3">
        <h3 className="font-medium text-sm">
          {members.length} Member{members.length !== 1 ? 's' : ''}
        </h3>
        <button
          type="button"
          onClick={onInviteMember}
          className="flex items-center gap-1.5 rounded-md bg-foreground/10 px-2.5 py-1 font-medium text-xs transition-colors hover:bg-foreground/15"
        >
          <UserPlus className="h-3.5 w-3.5" />
          Add Member
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {members.map((member) => (
          <button
            type="button"
            key={member.id}
            onClick={() => onSelectMember(member.id)}
            className={cn(
              'flex w-full items-center gap-3 border-foreground/5 border-b px-4 py-3 text-left transition-colors',
              selectedMemberId === member.id
                ? 'bg-foreground/5'
                : 'hover:bg-foreground/[0.02]',
            )}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground/10 font-medium text-xs">
              {member.displayName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate font-medium text-sm">
                  {member.displayName}
                </span>
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 font-medium text-[10px]',
                    ROLE_COLORS[member.role],
                  )}
                >
                  {member.role}
                </span>
                {member.status !== 'active' && (
                  <span className="rounded-full bg-yellow-500/15 px-2 py-0.5 font-medium text-[10px] text-yellow-600">
                    {member.status}
                  </span>
                )}
              </div>
              <div className="truncate text-muted-foreground text-xs">
                {member.email}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
