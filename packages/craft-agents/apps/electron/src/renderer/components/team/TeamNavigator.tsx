/**
 * TeamNavigator
 *
 * Navigator panel content for team management. Displays a list of team sections
 * (Members, Roles & Permissions, Activity Log, Organization) that can be selected
 * to show in the details panel.
 *
 * Styling follows SettingsNavigator patterns for visual consistency.
 */

import {
  Activity,
  AppWindow,
  Building2,
  MoreHorizontal,
  Shield,
  User,
  Users,
} from 'lucide-react'
import type * as React from 'react'
import { useState } from 'react'
import { DropdownMenuProvider } from '@/components/ui/menu-context'
import { Separator } from '@/components/ui/separator'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  StyledDropdownMenuContent,
  StyledDropdownMenuItem,
} from '@/components/ui/styled-dropdown'
import { cn } from '@/lib/utils'
import type { TeamSubpageType } from '../../../shared/types'

interface TeamNavigatorProps {
  selectedSubpage: TeamSubpageType
  onSelectSubpage: (subpage: TeamSubpageType) => void
}

interface TeamItem {
  id: TeamSubpageType
  label: string
  icon: React.ComponentType<{ className?: string }>
  description: string
}

const teamItems: TeamItem[] = [
  {
    id: 'my-profile',
    label: 'My Profile',
    icon: User,
    description: 'Edit your name and password',
  },
  {
    id: 'members',
    label: 'Members',
    icon: Users,
    description: 'Manage team members and roles',
  },
  {
    id: 'roles',
    label: 'Roles & Permissions',
    icon: Shield,
    description: 'Permission matrix by role',
  },
  {
    id: 'activity-log',
    label: 'Activity Log',
    icon: Activity,
    description: 'Audit trail of team actions',
  },
  {
    id: 'org-settings',
    label: 'Organization',
    icon: Building2,
    description: 'Organization name and plan',
  },
]

interface TeamItemRowProps {
  item: TeamItem
  isSelected: boolean
  isFirst: boolean
  onSelect: () => void
}

function TeamItemRow({
  item,
  isSelected,
  isFirst,
  onSelect,
}: TeamItemRowProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const Icon = item.icon

  const handleOpenInNewWindow = () => {
    window.electronAPI.openUrl(`craftagents://team/${item.id}?window=focused`)
  }

  return (
    <div className="settings-item" data-selected={isSelected || undefined}>
      {!isFirst && (
        <div className="settings-separator pr-4 pl-12">
          <Separator />
        </div>
      )}
      <div className="settings-content group relative mr-2 select-none pl-2">
        <div className="absolute top-[14px] left-[20px] z-10">
          <Icon
            className={cn(
              'h-4 w-4 shrink-0',
              isSelected ? 'text-foreground' : 'text-muted-foreground',
            )}
          />
        </div>
        <button
          type="button"
          onClick={onSelect}
          className={cn(
            'flex w-full items-start gap-2 rounded-[8px] py-3 pr-4 pl-2 text-left text-sm outline-none',
            'transition-[background-color] duration-75',
            isSelected
              ? 'bg-foreground/5 hover:bg-foreground/7'
              : 'hover:bg-foreground/2',
          )}
        >
          <div className="h-5 w-6 shrink-0" />
          <div className="flex min-w-0 flex-1 flex-col">
            <span
              className={cn(
                'font-medium',
                isSelected ? 'text-foreground' : 'text-foreground/80',
              )}
            >
              {item.label}
            </span>
            <span className="line-clamp-1 text-foreground/60 text-xs">
              {item.description}
            </span>
          </div>
        </button>
        <div
          className={cn(
            'absolute top-2 right-2 z-10 transition-opacity',
            menuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
          )}
        >
          <div className="flex items-center overflow-hidden rounded-[8px] border border-transparent hover:border-border/50">
            <DropdownMenu modal={true} onOpenChange={setMenuOpen}>
              <DropdownMenuTrigger asChild>
                <div className="cursor-pointer p-1.5 hover:bg-foreground/10 data-[state=open]:bg-foreground/10">
                  <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                </div>
              </DropdownMenuTrigger>
              <StyledDropdownMenuContent align="end">
                <DropdownMenuProvider>
                  <StyledDropdownMenuItem onClick={handleOpenInNewWindow}>
                    <AppWindow className="h-3.5 w-3.5" />
                    <span className="flex-1">Open in New Window</span>
                  </StyledDropdownMenuItem>
                </DropdownMenuProvider>
              </StyledDropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </div>
  )
}

export function TeamNavigator({
  selectedSubpage,
  onSelectSubpage,
}: TeamNavigatorProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto">
        <div className="pt-2">
          {teamItems.map((item, index) => (
            <TeamItemRow
              key={item.id}
              item={item}
              isSelected={selectedSubpage === item.id}
              isFirst={index === 0}
              onSelect={() => onSelectSubpage(item.id)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
