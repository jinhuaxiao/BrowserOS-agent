/**
 * MainContentPanel - Right panel component for displaying content
 *
 * Renders content based on the unified NavigationState:
 * - Chats navigator: ChatPage for selected session, or empty state
 * - Sources navigator: SourceInfoPage for selected source, or empty state
 * - Settings navigator: Settings, Preferences, or Shortcuts page
 *
 * The NavigationState is the single source of truth for what to display.
 *
 * In focused mode (single window), wraps content with StoplightProvider
 * so PanelHeader components automatically compensate for macOS traffic lights.
 */

import { useAtomValue } from 'jotai'
import { Cable, Plus } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'
import { skillsAtom } from '@/atoms/skills'
import { sourcesAtom } from '@/atoms/sources'
import { EditPopover, getEditConfig } from '@/components/ui/EditPopover'
import { HeaderIconButton } from '@/components/ui/HeaderIconButton'
import {
  useActiveWorkspace,
  useAppShellContext,
} from '@/context/AppShellContext'
import { StoplightProvider } from '@/context/StoplightContext'
import {
  isBrowserProfilesNavigation,
  isChatsNavigation,
  isConnectorsNavigation,
  isSettingsNavigation,
  isSkillsNavigation,
  isSourcesNavigation,
  isTeamNavigation,
  useNavigation,
  useNavigationState,
} from '@/contexts/NavigationContext'
import { useTeamSession } from '@/contexts/TeamContext'
import { usePermissions } from '@/hooks/use-permissions'
import { navigate, routes } from '@/lib/navigate'
import { cn } from '@/lib/utils'
import {
  AppSettingsPage,
  ChatPage,
  LabelsSettingsPage,
  PermissionsSettingsPage,
  PreferencesPage,
  ShortcutsPage,
  SourceInfoPage,
  WorkspaceSettingsPage,
} from '@/pages'
import SkillInfoPage from '@/pages/SkillInfoPage'
import SettingsNavigator from '@/pages/settings/SettingsNavigator'
import type {
  LoadedSkill,
  LoadedSource,
  Member,
  SettingsSubpage,
  SourceFilter,
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
import { PanelHeader } from './PanelHeader'
import { SkillsListPanel } from './SkillsListPanel'
import { SourcesListPanel } from './SourcesListPanel'
import { WelcomePage } from './WelcomePage'

function SourcesMainView({
  sources,
  sourceFilter,
  workspaceRootPath,
  onDeleteSource,
  onSourceClick,
  localMcpEnabled,
}: {
  sources: LoadedSource[]
  sourceFilter: SourceFilter | null
  workspaceRootPath?: string
  onDeleteSource: (slug: string) => void
  onSourceClick: (source: LoadedSource) => void
  localMcpEnabled: boolean
}) {
  const [activeTab, setActiveTab] = React.useState<
    'all' | 'api' | 'mcp' | 'local'
  >(sourceFilter?.kind === 'type' ? sourceFilter.sourceType : 'all')

  const filteredSources = React.useMemo(() => {
    if (activeTab === 'all') return sources
    return sources.filter((s) => s.config.type === activeTab)
  }, [sources, activeTab])

  return (
    <div className="flex h-full flex-col">
      <PanelHeader
        title="Sources"
        actions={
          workspaceRootPath ? (
            <EditPopover
              trigger={
                <HeaderIconButton
                  icon={<Plus className="h-4 w-4" />}
                  tooltip="Add Source"
                />
              }
              {...getEditConfig('add-source', workspaceRootPath)}
            />
          ) : undefined
        }
      />
      <div className="flex items-center gap-1 border-border border-b px-4 py-2">
        {(['all', 'api', 'mcp', 'local'] as const).map((tab) => (
          <button
            type="button"
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'rounded-md px-3 py-1 font-medium text-xs transition-colors',
              activeTab === tab
                ? 'bg-foreground/10 text-foreground'
                : 'text-foreground/50 hover:bg-foreground/5 hover:text-foreground/60',
            )}
          >
            {tab === 'all'
              ? 'All'
              : tab === 'api'
                ? 'APIs'
                : tab === 'mcp'
                  ? 'MCPs'
                  : 'Local Folders'}
          </button>
        ))}
      </div>
      <SourcesListPanel
        sources={filteredSources}
        workspaceRootPath={workspaceRootPath}
        onDeleteSource={onDeleteSource}
        onSourceClick={onSourceClick}
        localMcpEnabled={localMcpEnabled}
      />
    </div>
  )
}

function SkillsMainView({
  skills,
  workspaceId,
  workspaceRootPath,
  onSkillClick,
  onDeleteSkill,
}: {
  skills: LoadedSkill[]
  workspaceId?: string
  workspaceRootPath?: string
  onSkillClick: (skill: LoadedSkill) => void
  onDeleteSkill: (slug: string) => void
}) {
  return (
    <div className="flex h-full flex-col">
      <PanelHeader
        title="Skills"
        actions={
          workspaceRootPath ? (
            <EditPopover
              trigger={
                <HeaderIconButton
                  icon={<Plus className="h-4 w-4" />}
                  tooltip="Add Skill"
                />
              }
              {...getEditConfig('add-skill', workspaceRootPath)}
            />
          ) : undefined
        }
      />
      <SkillsListPanel
        skills={skills}
        workspaceId={workspaceId}
        workspaceRootPath={workspaceRootPath}
        onSkillClick={onSkillClick}
        onDeleteSkill={onDeleteSkill}
      />
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
  const { activeWorkspaceId } = useAppShellContext()
  const activeWorkspace = useActiveWorkspace()
  const { navigateToSource } = useNavigation()
  const sources = useAtomValue(sourcesAtom)
  const skills = useAtomValue(skillsAtom)

  const sourceFilter: SourceFilter | null = isSourcesNavigation(navState)
    ? (navState.filter ?? null)
    : null

  const handleSourceSelect = React.useCallback(
    (source: LoadedSource) => {
      if (!activeWorkspaceId) return
      navigateToSource(source.config.slug)
    },
    [activeWorkspaceId, navigateToSource],
  )

  const handleSkillSelect = React.useCallback(
    (skill: LoadedSkill) => {
      if (!activeWorkspaceId) return
      navigate(routes.view.skills(skill.slug))
    },
    [activeWorkspaceId],
  )

  const handleDeleteSource = React.useCallback(
    async (sourceSlug: string) => {
      if (!activeWorkspace) return
      try {
        await window.electronAPI.deleteSource(activeWorkspace.id, sourceSlug)
        toast.success('Deleted source')
      } catch (error) {
        console.error('Failed to delete source:', error)
        toast.error('Failed to delete source')
      }
    },
    [activeWorkspace],
  )

  const handleDeleteSkill = React.useCallback(
    async (skillSlug: string) => {
      if (!activeWorkspace) return
      try {
        await window.electronAPI.deleteSkill(activeWorkspace.id, skillSlug)
        toast.success(`Deleted skill: ${skillSlug}`)
      } catch (error) {
        console.error('Failed to delete skill:', error)
        toast.error('Failed to delete skill')
      }
    },
    [activeWorkspace],
  )

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

  // Sources navigator - show source info with list, or full-width list
  if (isSourcesNavigation(navState)) {
    if (navState.details) {
      return wrapWithStoplight(
        <Panel variant="grow" className={className}>
          <div className="flex h-full">
            <div className="flex w-[280px] shrink-0 flex-col border-border border-r">
              <SourcesListPanel
                sources={sources}
                sourceFilter={sourceFilter}
                workspaceRootPath={activeWorkspace?.rootPath}
                onDeleteSource={handleDeleteSource}
                onSourceClick={handleSourceSelect}
                selectedSourceSlug={navState.details.sourceSlug}
                localMcpEnabled={true}
              />
            </div>
            <div className="min-w-0 flex-1">
              <SourceInfoPage
                sourceSlug={navState.details.sourceSlug}
                workspaceId={activeWorkspaceId || ''}
              />
            </div>
          </div>
        </Panel>,
      )
    }
    // No source selected - full-width list with header
    return wrapWithStoplight(
      <Panel variant="grow" className={className}>
        <SourcesMainView
          sources={sources}
          sourceFilter={sourceFilter}
          workspaceRootPath={activeWorkspace?.rootPath}
          onDeleteSource={handleDeleteSource}
          onSourceClick={handleSourceSelect}
          localMcpEnabled={true}
        />
      </Panel>,
    )
  }

  // Skills navigator - show skill info with list, or full-width list
  if (isSkillsNavigation(navState)) {
    if (navState.details) {
      return wrapWithStoplight(
        <Panel variant="grow" className={className}>
          <div className="flex h-full">
            <div className="flex w-[280px] shrink-0 flex-col border-border border-r">
              <SkillsListPanel
                skills={skills}
                workspaceId={activeWorkspaceId ?? undefined}
                workspaceRootPath={activeWorkspace?.rootPath}
                onSkillClick={handleSkillSelect}
                onDeleteSkill={handleDeleteSkill}
                selectedSkillSlug={navState.details.skillSlug}
              />
            </div>
            <div className="min-w-0 flex-1">
              <SkillInfoPage
                skillSlug={navState.details.skillSlug}
                workspaceId={activeWorkspaceId || ''}
              />
            </div>
          </div>
        </Panel>,
      )
    }
    // No skill selected - full-width list with header
    return wrapWithStoplight(
      <Panel variant="grow" className={className}>
        <SkillsMainView
          skills={skills}
          workspaceId={activeWorkspaceId ?? undefined}
          workspaceRootPath={activeWorkspace?.rootPath}
          onSkillClick={handleSkillSelect}
          onDeleteSkill={handleDeleteSkill}
        />
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

  // Connectors navigator - placeholder
  if (isConnectorsNavigation(navState)) {
    return wrapWithStoplight(
      <Panel variant="grow" className={className}>
        <div className="flex h-full flex-col items-center justify-center gap-3 text-foreground/50">
          <Cable className="h-10 w-10 text-foreground/50/40" />
          <p className="text-sm">Connectors coming soon</p>
          <p className="max-w-[320px] text-center text-foreground/50/60 text-xs">
            Connect your apps and services so your agent can access and act on
            your data.
          </p>
        </div>
      </Panel>,
    )
  }

  // Chats navigator - show chat or welcome page
  if (isChatsNavigation(navState)) {
    if (navState.details) {
      return wrapWithStoplight(
        <Panel variant="grow" className={className}>
          <ChatPage sessionId={navState.details.sessionId} />
        </Panel>,
      )
    }
    // No session selected - show welcome page with real input
    return wrapWithStoplight(
      <Panel variant="grow" className={cn(className, "bg-background")}>
        <WelcomePage />
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
