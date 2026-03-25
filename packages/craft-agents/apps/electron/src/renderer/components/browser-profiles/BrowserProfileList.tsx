/**
 * Browser Profile List Component
 *
 * Displays a list of browser profiles with status and actions.
 * Includes group sidebar for filtering and proxy/template management tabs.
 * Redesigned to match Amazon Seller Central style.
 */

import {
  CheckSquareIcon,
  ChevronLeftIcon,
  FolderIcon,
  LayoutTemplateIcon,
  Loader2Icon,
  PlayIcon,
  PlusIcon,
  SettingsIcon,
  SquareIcon,
  StopCircleIcon,
  UsersIcon,
  XIcon,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useTeamSession } from '@/contexts/TeamContext'
import { usePermissions } from '@/hooks/use-permissions'
import { useProfileFilter } from '@/hooks/use-profile-filter'
import type {
  BrowserProfileConfig,
  LaunchResult,
  ProfileAssignment,
} from '../../../shared/types'
import { BrowserProfileCard } from './BrowserProfileCard'
import { BrowserSettingsDialog } from './BrowserSettingsDialog'
import { CreateProfileDialog } from './CreateProfileDialog'
import { EditProfileDialog } from './EditProfileDialog'
import { GroupSidebar } from './Groups/GroupSidebar'
import { ProfileFilterBar } from './ProfileFilterBar'
import { TemplateList } from './Templates/TemplateList'
import { TrashView } from './TrashView'

type TabType = 'profiles' | 'templates'
type ProfileFilter = 'all' | 'mine'

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: complex UI component
export function BrowserProfileList() {
  const [profiles, setProfiles] = useState<BrowserProfileConfig[]>([])
  const [runningProfiles, setRunningProfiles] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editingProfile, setEditingProfile] =
    useState<BrowserProfileConfig | null>(null)

  // UI state
  const [activeTab, setActiveTab] = useState<TabType>('profiles')
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
  const [showSidebar, setShowSidebar] = useState(true)
  const [showBrowserSettings, setShowBrowserSettings] = useState(false)
  const [profileFilter, setProfileFilter] = useState<ProfileFilter>('all')

  // Batch selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [batchLoading, setBatchLoading] = useState(false)

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  // selectAll will be called from the batch bar after displayProfiles is available
  const selectAllProfiles = (ids: string[]) => {
    setSelectedIds(new Set(ids))
  }

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  // Team permissions
  const permissions = usePermissions()
  const session = useTeamSession()
  const [assignments, setAssignments] = useState<ProfileAssignment[]>([])
  const [memberNames, setMemberNames] = useState<Record<string, string>>({})

  const loadProfiles = useCallback(async () => {
    try {
      const [profileList, running] = await Promise.all([
        window.electronAPI.listBrowserProfiles(),
        window.electronAPI.getRunningBrowserProfiles(),
      ])
      setProfiles(profileList)
      setRunningProfiles(new Set(running))

      // Load assignments and member names for team context
      if (session?.organization?.id) {
        const orgId = session.organization.id
        const [assignmentList, memberList] = await Promise.all([
          window.electronAPI.teamListProfileAssignments(orgId),
          window.electronAPI.teamListMembers(orgId),
        ])
        setAssignments(assignmentList)
        const names: Record<string, string> = {}
        for (const m of memberList) {
          names[m.id] = m.displayName
        }
        setMemberNames(names)
      }
    } catch (error) {
      console.error('Failed to load browser profiles:', error)
    } finally {
      setIsLoading(false)
    }
  }, [session?.organization?.id])

  useEffect(() => {
    loadProfiles()

    // Refresh running status periodically
    const interval = setInterval(async () => {
      try {
        const running = await window.electronAPI.getRunningBrowserProfiles()
        setRunningProfiles(new Set(running))
      } catch (error) {
        console.error('Failed to refresh running status:', error)
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [loadProfiles])

  // Compute assigned profile IDs for current member
  const myAssignedProfileIds = useMemo(() => {
    if (!permissions.currentMemberId) return []
    return assignments
      .filter((a) => a.memberId === permissions.currentMemberId)
      .map((a) => a.profileId)
  }, [assignments, permissions.currentMemberId])

  // Get assignee info for a profile
  const getProfileAssignees = useCallback(
    (profileId: string) => {
      return assignments
        .filter((a) => a.profileId === profileId)
        .map((a) => ({
          memberId: a.memberId,
          name: memberNames[a.memberId] || 'Unknown',
          permissions: a.permissions,
        }))
    },
    [assignments, memberNames],
  )

  // Filter profiles by selected group + permissions + mine/all toggle
  const filteredProfiles = useMemo(() => {
    let result = profiles

    // Group filter
    if (selectedGroupId === 'ungrouped') {
      result = result.filter((p) => !p.groupId)
    } else if (selectedGroupId !== null) {
      result = result.filter((p) => p.groupId === selectedGroupId)
    }

    // Permission filter: operator/viewer can only see assigned profiles
    if (permissions.isOperator || permissions.isViewer) {
      result = result.filter((p) => myAssignedProfileIds.includes(p.id))
    } else if (profileFilter === 'mine' && permissions.currentMemberId) {
      // "Mine" filter for managers+: show only profiles assigned to me
      result = result.filter((p) => myAssignedProfileIds.includes(p.id))
    }

    return result
  }, [
    profiles,
    selectedGroupId,
    permissions,
    profileFilter,
    myAssignedProfileIds,
  ])

  const {
    filter: profileFilter2,
    sort: profileSort,
    filteredProfiles: displayProfiles,
    setSearchQuery,
    toggleStatusFilter,
    setPlatformFilter,
    setTagFilter,
    clearFilters,
    setSortField,
    hasActiveFilters,
    availableTags,
    availablePlatforms,
  } = useProfileFilter(filteredProfiles, runningProfiles)

  const handleLaunch = async (profileId: string): Promise<LaunchResult> => {
    const result = await window.electronAPI.launchBrowserProfile(profileId)
    if (result.success) {
      setRunningProfiles((prev) => new Set([...prev, profileId]))
    }
    return result
  }

  const handleStop = async (profileId: string): Promise<boolean> => {
    const stopped = await window.electronAPI.stopBrowserProfile(profileId)
    if (stopped) {
      setRunningProfiles((prev) => {
        const next = new Set(prev)
        next.delete(profileId)
        return next
      })
    }
    return stopped
  }

  const handleDelete = async (profileId: string): Promise<boolean> => {
    if (!profileId) {
      console.error('handleDelete: profileId is undefined!')
      return false
    }
    const deleted = await window.electronAPI.deleteBrowserProfile(profileId)
    if (deleted) {
      setProfiles((prev) => prev.filter((p) => p.id !== profileId))
    }
    return deleted
  }

  const handleProfileCreated = (profile: BrowserProfileConfig) => {
    setProfiles((prev) => [profile, ...prev])
    setShowCreateDialog(false)
  }

  const handleProfileUpdated = (updatedProfile: BrowserProfileConfig) => {
    setProfiles((prev) =>
      prev.map((p) => (p.id === updatedProfile.id ? updatedProfile : p)),
    )
    setEditingProfile(null)
  }

  const handleEditProfile = (profile: BrowserProfileConfig) => {
    setEditingProfile(profile)
  }

  // Batch operations
  const handleBatchLaunch = async () => {
    setBatchLoading(true)
    try {
      for (const id of selectedIds) {
        if (!runningProfiles.has(id)) {
          await handleLaunch(id)
        }
      }
    } finally {
      setBatchLoading(false)
      clearSelection()
    }
  }

  const handleBatchStop = async () => {
    setBatchLoading(true)
    try {
      for (const id of selectedIds) {
        if (runningProfiles.has(id)) {
          await handleStop(id)
        }
      }
    } finally {
      setBatchLoading(false)
      clearSelection()
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-foreground/50">Loading profiles...</div>
      </div>
    )
  }

  return (
    <div className="flex h-full bg-background">
      {/* Sidebar */}
      {showSidebar && activeTab === 'profiles' && (
        <div className="w-56 flex-shrink-0 border-border border-r bg-card">
          <GroupSidebar
            selectedGroupId={selectedGroupId}
            onSelectGroup={setSelectedGroupId}
          />
        </div>
      )}

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header with tabs */}
        <div className="border-border border-b bg-card shadow-thin">
          {/* Header row - titlebar-drag-region for window dragging, buttons opt out */}
          <div className="titlebar-drag-region relative z-overlay flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              {/* Toggle sidebar button */}
              {activeTab === 'profiles' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSidebar(!showSidebar)}
                  title={showSidebar ? 'Hide sidebar' : 'Show sidebar'}
                  className="titlebar-no-drag text-foreground/50 hover:bg-foreground/5 hover:text-foreground"
                >
                  {showSidebar ? (
                    <ChevronLeftIcon className="h-4 w-4" />
                  ) : (
                    <FolderIcon className="h-4 w-4" />
                  )}
                </Button>
              )}

              <div>
                <h2 className="font-bold text-foreground text-xl leading-none">
                  {activeTab === 'profiles' && 'Browser Profiles'}
                  {activeTab === 'templates' && 'Templates'}
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* My/All filter toggle - visible for manager+ roles */}
              {activeTab === 'profiles' && permissions.canCreateProfile && (
                <div className="titlebar-no-drag flex items-center overflow-hidden rounded-lg border border-border bg-card">
                  <button
                    type="button"
                    className={`px-3 py-1.5 font-medium text-xs transition-colors ${
                      profileFilter === 'all'
                        ? 'bg-foreground text-background'
                        : 'text-foreground/50 hover:bg-foreground/5'
                    }`}
                    onClick={() => setProfileFilter('all')}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    className={`border-border border-l px-3 py-1.5 font-medium text-xs transition-colors ${
                      profileFilter === 'mine'
                        ? 'bg-foreground text-background'
                        : 'text-foreground/50 hover:bg-foreground/5'
                    }`}
                    onClick={() => setProfileFilter('mine')}
                  >
                    <UsersIcon className="mr-1 inline h-3 w-3" />
                    Mine
                  </button>
                </div>
              )}

              {/* Settings button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowBrowserSettings(true)}
                title="Browser Settings"
                className="titlebar-no-drag text-foreground/50 hover:bg-foreground/5 hover:text-foreground"
              >
                <SettingsIcon className="h-4 w-4" />
              </Button>

              {activeTab === 'profiles' && permissions.canCreateProfile && (
                <Button
                  onClick={() => setShowCreateDialog(true)}
                  size="sm"
                  className="titlebar-no-drag bg-foreground font-medium text-background shadow-sm hover:bg-foreground/90"
                >
                  <PlusIcon className="mr-2 h-4 w-4" />
                  New Profile
                </Button>
              )}
            </div>
          </div>

          {/* Tab navigation */}
          <div className="flex px-4 pt-2">
            <button
              type="button"
              className={`titlebar-no-drag flex items-center border-b-2 px-4 py-2 font-medium text-sm transition-colors ${
                activeTab === 'profiles'
                  ? 'border-foreground text-foreground'
                  : 'border-transparent text-foreground/50 hover:border-border hover:text-foreground'
              }
              `}
              onClick={() => setActiveTab('profiles')}
            >
              <FolderIcon className="mr-2 h-4 w-4" />
              Profiles
              <span className="ml-2 rounded-full bg-foreground/5 px-1.5 py-0.5 font-normal text-foreground/50 text-xs">
                {displayProfiles.length}
              </span>
            </button>
            <button
              type="button"
              className={`titlebar-no-drag flex items-center border-b-2 px-4 py-2 font-medium text-sm transition-colors ${
                activeTab === 'templates'
                  ? 'border-foreground text-foreground'
                  : 'border-transparent text-foreground/50 hover:border-border hover:text-foreground'
              }
              `}
              onClick={() => setActiveTab('templates')}
            >
              <LayoutTemplateIcon className="mr-2 h-4 w-4" />
              Templates
            </button>
          </div>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto bg-background p-6">
          {activeTab === 'profiles' && selectedGroupId === 'trash' && (
            <TrashView />
          )}

          {activeTab === 'profiles' && selectedGroupId !== 'trash' && (
            <div className="">
              <ProfileFilterBar
                filter={profileFilter2}
                sort={profileSort}
                onSearchChange={setSearchQuery}
                onToggleStatus={toggleStatusFilter}
                onPlatformChange={setPlatformFilter}
                onTagChange={setTagFilter}
                onSortChange={setSortField}
                onClear={clearFilters}
                hasActiveFilters={hasActiveFilters}
                availableTags={availableTags}
                availablePlatforms={availablePlatforms}
                resultCount={displayProfiles.length}
                totalCount={filteredProfiles.length}
              />

              {/* Batch Action Bar */}
              {selectedIds.size > 0 && (
                <div className="mb-4 flex items-center gap-3 rounded-lg border border-accent/30 bg-accent/5 px-4 py-2.5">
                  <span className="text-sm font-medium">
                    {selectedIds.size} selected
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => selectAllProfiles(displayProfiles.map((p) => p.id))}
                  >
                    <CheckSquareIcon className="mr-1 h-3.5 w-3.5" />
                    Select All
                  </Button>
                  <div className="h-4 w-px bg-border" />
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={handleBatchLaunch}
                    disabled={batchLoading}
                  >
                    {batchLoading ? (
                      <Loader2Icon className="mr-1 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <PlayIcon className="mr-1 h-3.5 w-3.5" />
                    )}
                    Launch Selected
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={handleBatchStop}
                    disabled={batchLoading}
                  >
                    <StopCircleIcon className="mr-1 h-3.5 w-3.5" />
                    Stop Selected
                  </Button>
                  <div className="ml-auto">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0"
                      onClick={clearSelection}
                    >
                      <XIcon className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}

              {displayProfiles.length === 0 ? (
                <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-border bg-card p-8 text-center">
                  <div className="mb-4 text-foreground/50">
                    {hasActiveFilters
                      ? 'No profiles match the current filters'
                      : selectedGroupId === null
                        ? 'No browser profiles yet'
                        : selectedGroupId === 'ungrouped'
                          ? 'No ungrouped profiles'
                          : 'No profiles in this group'}
                  </div>
                  {hasActiveFilters ? (
                    <Button
                      onClick={clearFilters}
                      variant="outline"
                      className="border-border text-foreground/50"
                    >
                      Clear Filters
                    </Button>
                  ) : (
                    <Button
                      onClick={() => setShowCreateDialog(true)}
                      className="bg-foreground text-background hover:bg-foreground/90"
                    >
                      <PlusIcon className="mr-2 h-4 w-4" />
                      Create Profile
                    </Button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-5">
                  {displayProfiles.map((profile) => (
                    <BrowserProfileCard
                      key={profile.id}
                      profile={profile}
                      isRunning={runningProfiles.has(profile.id)}
                      selected={selectedIds.has(profile.id)}
                      onToggleSelect={() => toggleSelect(profile.id)}
                      onLaunch={handleLaunch}
                      onStop={handleStop}
                      onDelete={handleDelete}
                      onRefresh={loadProfiles}
                      onEdit={handleEditProfile}
                      assignees={getProfileAssignees(profile.id)}
                      canLaunch={permissions.canLaunchProfile(
                        profile.id,
                        myAssignedProfileIds,
                      )}
                      canDelete={permissions.canDeleteProfile}
                      canEdit={permissions.canCreateProfile}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'templates' && (
            <TemplateList onProfileCreated={handleProfileCreated} />
          )}
        </div>
      </div>

      {/* Create Profile Dialog */}
      {showCreateDialog && (
        <CreateProfileDialog
          onClose={() => setShowCreateDialog(false)}
          onCreated={handleProfileCreated}
        />
      )}

      {/* Edit Profile Dialog */}
      {editingProfile && (
        <EditProfileDialog
          profile={editingProfile}
          onClose={() => setEditingProfile(null)}
          onUpdated={handleProfileUpdated}
        />
      )}

      {/* Browser Settings Dialog */}
      <BrowserSettingsDialog
        open={showBrowserSettings}
        onClose={() => setShowBrowserSettings(false)}
      />
    </div>
  )
}
