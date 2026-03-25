/**
 * MainContentPanel - Right panel component for displaying content
 *
 * Renders content based on the unified NavigationState:
 * - Dashboard: Overview page
 * - Browser Profiles: Profile list and management
 * - Proxies: Proxy pool management
 * - Agent: AI browser automation agent
 * - Tasks: Task queue
 * - Team: Team management pages
 * - Settings: Settings, Preferences, or Shortcuts page
 *
 * The NavigationState is the single source of truth for what to display.
 *
 * In focused mode (single window), wraps content with StoplightProvider
 * so PanelHeader components automatically compensate for macOS traffic lights.
 */

import * as React from 'react'
import { StoplightProvider } from '@/context/StoplightContext'
import {
  isBrowserProfilesNavigation,
  isSettingsNavigation,
  isTeamNavigation,
  useNavigationState,
} from '@/contexts/NavigationContext'
import {
  isDashboardNavigation,
  isProxiesNavigation,
  isAgentNavigation,
  isTasksNavigation,
} from '../../shared/types'
import { useTeamSession } from '@/contexts/TeamContext'
import { usePermissions } from '@/hooks/use-permissions'
import { navigate, routes } from '@/lib/navigate'
import {
  AppSettingsPage,
  LabelsSettingsPage,
  PermissionsSettingsPage,
  PreferencesPage,
  ShortcutsPage,
  WorkspaceSettingsPage,
} from '@/pages'
import SettingsNavigator from '@/pages/settings/SettingsNavigator'
import type {
  Member,
  SettingsSubpage,
  TeamSubpageType,
  UpdateMemberInput,
  UpdateOrganizationInput,
} from '../../../shared/types'
import { BrowserProfileList } from '../browser-profiles'
import { ActivityLogPanel } from '../team/ActivityLogPanel'
import { InviteMemberDialog } from '../team/InviteMemberDialog'
import { MemberDetail } from '../team/MemberDetail'
import { MemberList } from '../team/MemberList'
import { MemberProfileEditor } from '../team/MemberProfileEditor'
import { OrgSettingsPanel } from '../team/OrgSettingsPanel'
import { RoleConfigPanel } from '../team/RoleConfigPanel'
import { TeamNavigator } from '../team/TeamNavigator'
import { Panel } from './Panel'

function DashboardPage() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="mt-2 text-foreground/50">Overview coming soon</p>
      </div>
    </div>
  )
}

function ProxiesPage() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Proxy Pool</h1>
        <p className="mt-2 text-foreground/50">Proxy management coming soon</p>
      </div>
    </div>
  )
}

function AgentPage() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold">AI Agent</h1>
        <p className="mt-2 text-foreground/50">Browser automation agent coming soon</p>
      </div>
    </div>
  )
}

function TasksPage() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Tasks</h1>
        <p className="mt-2 text-foreground/50">Task queue coming soon</p>
      </div>
    </div>
  )
}

function TeamManagementView({
  subpage,
  memberDetail,
}: {
  subpage: TeamSubpageType
  memberDetail: { type: 'member'; memberId: string } | null
}) {
  const session = useTeamSession()
  const permissions = usePermissions()
  const [members, setMembers] = React.useState<Omit<Member, 'passwordHash'>[]>(
    [],
  )
  const [selectedMember, setSelectedMember] = React.useState<Omit<
    Member,
    'passwordHash'
  > | null>(null)
  const [showInviteDialog, setShowInviteDialog] = React.useState(false)

  const orgId = session?.organization?.id

  const loadMembers = React.useCallback(async () => {
    if (!orgId) return
    try {
      const result = await window.electronAPI.teamListMembers(orgId)
      setMembers(result)
    } catch (err) {
      console.error('Failed to load members:', err)
    }
  }, [orgId])

  React.useEffect(() => {
    loadMembers()
  }, [loadMembers])

  React.useEffect(() => {
    if (memberDetail?.memberId) {
      const member = members.find((m) => m.id === memberDetail.memberId)
      if (member) {
        setSelectedMember(member)
      } else if (orgId) {
        window.electronAPI
          .teamGetMember(memberDetail.memberId)
          .then(setSelectedMember)
      }
    } else {
      setSelectedMember(null)
    }
  }, [memberDetail, members, orgId])

  const handleUpdateMember = React.useCallback(
    async (memberId: string, input: UpdateMemberInput) => {
      await window.electronAPI.teamUpdateMember(memberId, input)
      await loadMembers()
    },
    [loadMembers],
  )

  const handleDeleteMember = React.useCallback(
    async (memberId: string) => {
      await window.electronAPI.teamDeleteMember(memberId)
      await loadMembers()
    },
    [loadMembers],
  )

  const handleInviteMember = React.useCallback(
    async (
      input: Parameters<typeof window.electronAPI.teamCreateMember>[0],
    ) => {
      await window.electronAPI.teamCreateMember(input)
      await loadMembers()
    },
    [loadMembers],
  )

  const handleUpdateOrg = React.useCallback(
    async (input: UpdateOrganizationInput) => {
      if (!orgId) return
      await window.electronAPI.teamUpdateOrg(orgId, input)
    },
    [orgId],
  )

  const handleTeamSubpageClick = React.useCallback((sub: string) => {
    navigate(routes.view.team(sub as TeamSubpageType))
  }, [])

  const handleSelectMember = React.useCallback((memberId: string) => {
    navigate(routes.view.team('members', memberId))
  }, [])

  const teamContent = (() => {
    switch (subpage) {
      case 'roles':
        return <RoleConfigPanel />
      case 'activity-log':
        return orgId ? <ActivityLogPanel organizationId={orgId} /> : null
      case 'my-profile':
        return <MemberProfileEditor />
      case 'org-settings':
        return session?.organization ? (
          <OrgSettingsPanel
            organization={session.organization}
            onUpdate={handleUpdateOrg}
            canEdit={permissions.canManageOrgSettings}
          />
        ) : null
      default:
        if (selectedMember) {
          return (
            <div className="flex h-full">
              <div className="w-[280px] shrink-0 border-border border-r">
                <MemberList
                  members={members}
                  onSelectMember={handleSelectMember}
                  onInviteMember={() => setShowInviteDialog(true)}
                  selectedMemberId={selectedMember.id}
                />
              </div>
              <div className="min-w-0 flex-1">
                <MemberDetail
                  member={selectedMember}
                  onUpdateMember={handleUpdateMember}
                  onDeleteMember={handleDeleteMember}
                  canEdit={permissions.canManageMembers}
                />
              </div>
            </div>
          )
        }
        return (
          <MemberList
            members={members}
            onSelectMember={handleSelectMember}
            onInviteMember={() => setShowInviteDialog(true)}
          />
        )
    }
  })()

  return (
    <div className="flex h-full">
      <div className="w-[220px] shrink-0 border-border border-r">
        <TeamNavigator
          selectedSubpage={subpage}
          onSelectSubpage={handleTeamSubpageClick}
        />
      </div>
      <div className="min-w-0 flex-1">{teamContent}</div>
      {orgId && (
        <InviteMemberDialog
          organizationId={orgId}
          open={showInviteDialog}
          onClose={() => setShowInviteDialog(false)}
          onInvite={handleInviteMember}
        />
      )}
    </div>
  )
}

export interface MainContentPanelProps {
  /** Whether the app is in focused mode (single chat, no sidebar) */
  isFocusedMode?: boolean
  /** Optional className for the container */
  className?: string
}

export function MainContentPanel({
  isFocusedMode = false,
  className,
}: MainContentPanelProps) {
  const navState = useNavigationState()

  const handleSettingsClick = React.useCallback(
    (subpage: SettingsSubpage = 'app') => {
      navigate(routes.view.settings(subpage))
    },
    [],
  )

  // Wrap content with StoplightProvider so PanelHeaders auto-compensate in focused mode
  const wrapWithStoplight = (content: React.ReactNode) => (
    <StoplightProvider value={isFocusedMode}>{content}</StoplightProvider>
  )

  // Settings navigator - always has content (subpage determines which page)
  if (isSettingsNavigation(navState)) {
    const settingsContent = (() => {
      switch (navState.subpage) {
        case 'workspace':
          return <WorkspaceSettingsPage />
        case 'permissions':
          return <PermissionsSettingsPage />
        case 'labels':
          return <LabelsSettingsPage />
        case 'shortcuts':
          return <ShortcutsPage />
        case 'preferences':
          return <PreferencesPage />
        default:
          return <AppSettingsPage />
      }
    })()

    return wrapWithStoplight(
      <Panel variant="grow" className={className}>
        <div className="flex h-full">
          <div className="w-[220px] shrink-0 border-border border-r">
            <SettingsNavigator
              selectedSubpage={navState.subpage}
              onSelectSubpage={(subpage) => handleSettingsClick(subpage)}
            />
          </div>
          <div className="min-w-0 flex-1">{settingsContent}</div>
        </div>
      </Panel>,
    )
  }

  // Dashboard navigator
  if (isDashboardNavigation(navState)) {
    return wrapWithStoplight(
      <Panel variant="grow" className={className}>
        <DashboardPage />
      </Panel>,
    )
  }

  // Browser Profiles navigator - shows full list in main panel
  if (isBrowserProfilesNavigation(navState)) {
    return wrapWithStoplight(
      <Panel variant="grow" className={className}>
        <BrowserProfileList />
      </Panel>,
    )
  }

  // Team navigator - shows team management pages
  if (isTeamNavigation(navState)) {
    return wrapWithStoplight(
      <Panel variant="grow" className={className}>
        <TeamManagementView
          subpage={navState.subpage}
          memberDetail={navState.details}
        />
      </Panel>,
    )
  }

  // Proxies navigator
  if (isProxiesNavigation(navState)) {
    return wrapWithStoplight(
      <Panel variant="grow" className={className}>
        <ProxiesPage />
      </Panel>,
    )
  }

  // Agent navigator
  if (isAgentNavigation(navState)) {
    return wrapWithStoplight(
      <Panel variant="grow" className={className}>
        <AgentPage />
      </Panel>,
    )
  }

  // Tasks navigator
  if (isTasksNavigation(navState)) {
    return wrapWithStoplight(
      <Panel variant="grow" className={className}>
        <TasksPage />
      </Panel>,
    )
  }

  // Fallback (should not happen with proper NavigationState)
  return wrapWithStoplight(
    <Panel variant="grow" className={className}>
      <div className="flex h-full items-center justify-center text-foreground/50">
        <p className="text-sm">Select a task to get started</p>
      </div>
    </Panel>,
  )
}
