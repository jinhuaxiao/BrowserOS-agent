/**
 * Browser Profile List Component
 *
 * Displays a list of browser profiles with status and actions.
 * Includes group sidebar for filtering and proxy/template management tabs.
 * Redesigned to match Amazon Seller Central style.
 */

import {
  ChevronLeftIcon,
  ChevronRightIcon,
  FolderIcon,
  LayoutTemplateIcon,
  NetworkIcon,
  PlusIcon,
  SettingsIcon,
  UsersIcon,
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
import { ProxyPoolPanel } from './ProxyManagement/ProxyPoolPanel'
import { TemplateList } from './Templates/TemplateList'
import { TrashView } from './TrashView'

type TabType = 'profiles' | 'proxies' | 'templates'
type ProfileFilter = 'all' | 'mine'

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading profiles...</div>
      </div>
    )
  }

  return (
    <div className="flex h-full bg-gray-50">
      {/* Sidebar */}
      {showSidebar && activeTab === 'profiles' && (
        <div className="w-56 border-r border-[#D5D9D9] bg-white flex-shrink-0">
          <GroupSidebar
            selectedGroupId={selectedGroupId}
            onSelectGroup={setSelectedGroupId}
          />
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header with tabs - Amazon Seller Central Style */}
        <div className="border-b border-[#D5D9D9] bg-white shadow-sm">
          {/* Header row - z-overlay and titlebar-no-drag to allow clicking */}
          <div className="flex items-center justify-between px-4 py-3 relative z-overlay titlebar-no-drag bg-white text-[#0F1111]">
            <div className="flex items-center gap-3">
              {/* Toggle sidebar button */}
              {activeTab === 'profiles' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSidebar(!showSidebar)}
                  title={showSidebar ? 'Hide sidebar' : 'Show sidebar'}
                  className="text-[#565959] hover:text-[#0F1111] hover:bg-gray-100 titlebar-no-drag"
                >
                  {showSidebar ? (
                    <ChevronLeftIcon className="w-4 h-4" />
                  ) : (
                    <FolderIcon className="w-4 h-4" />
                  )}
                </Button>
              )}

              <div>
                <h2 className="text-xl font-bold leading-none">
                  {activeTab === 'profiles' && 'Browser Profiles'}
                  {activeTab === 'proxies' && 'Proxy Pool'}
                  {activeTab === 'templates' && 'Templates'}
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* My/All filter toggle - visible for manager+ roles */}
              {activeTab === 'profiles' && permissions.canCreateProfile && (
                <div className="flex items-center rounded border border-[#D5D9D9] bg-white overflow-hidden titlebar-no-drag">
                  <button
                    className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                      profileFilter === 'all'
                        ? 'bg-[#FF9900] text-black'
                        : 'text-[#565959] hover:bg-gray-50'
                    }`}
                    onClick={() => setProfileFilter('all')}
                  >
                    All
                  </button>
                  <button
                    className={`px-3 py-1.5 text-xs font-medium transition-colors border-l border-[#D5D9D9] ${
                      profileFilter === 'mine'
                        ? 'bg-[#FF9900] text-black'
                        : 'text-[#565959] hover:bg-gray-50'
                    }`}
                    onClick={() => setProfileFilter('mine')}
                  >
                    <UsersIcon className="w-3 h-3 inline mr-1" />
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
                className="text-[#565959] hover:text-[#0F1111] hover:bg-gray-100 titlebar-no-drag"
              >
                <SettingsIcon className="w-4 h-4" />
              </Button>

              {activeTab === 'profiles' && permissions.canCreateProfile && (
                <Button
                  onClick={() => setShowCreateDialog(true)}
                  size="sm"
                  className="bg-[#FF9900] hover:bg-[#FA8900] text-black border border-[#A88734] font-medium shadow-sm titlebar-no-drag"
                >
                  <PlusIcon className="w-4 h-4 mr-2" />
                  New Profile
                </Button>
              )}
            </div>
          </div>

          {/* Tab navigation */}
          <div className="flex px-4 pt-2 bg-white">
            <button
              className={`
                flex items-center px-4 py-2 text-sm font-bold border-b-2 transition-colors
                ${
                  activeTab === 'profiles'
                    ? 'border-[#FF9900] text-[#0F1111]'
                    : 'border-transparent text-[#565959] hover:text-[#FF9900] hover:border-gray-300'
                }
              `}
              onClick={() => setActiveTab('profiles')}
            >
              <FolderIcon className="w-4 h-4 mr-2" />
              Profiles
              <span className="ml-2 bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full text-xs font-normal">
                {displayProfiles.length}
              </span>
            </button>
            <button
              className={`
                flex items-center px-4 py-2 text-sm font-bold border-b-2 transition-colors
                ${
                  activeTab === 'proxies'
                    ? 'border-[#FF9900] text-[#0F1111]'
                    : 'border-transparent text-[#565959] hover:text-[#FF9900] hover:border-gray-300'
                }
              `}
              onClick={() => setActiveTab('proxies')}
            >
              <NetworkIcon className="w-4 h-4 mr-2" />
              Proxies
            </button>
            <button
              className={`
                flex items-center px-4 py-2 text-sm font-bold border-b-2 transition-colors
                ${
                  activeTab === 'templates'
                    ? 'border-[#FF9900] text-[#0F1111]'
                    : 'border-transparent text-[#565959] hover:text-[#FF9900] hover:border-gray-300'
                }
              `}
              onClick={() => setActiveTab('templates')}
            >
              <LayoutTemplateIcon className="w-4 h-4 mr-2" />
              Templates
            </button>
          </div>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto bg-[#F2F4F8] p-4">
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
              {displayProfiles.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-center bg-white rounded border border-[#D5D9D9] p-8">
                  <div className="text-[#565959] mb-4">
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
                      className="text-[#565959] border-[#D5D9D9]"
                    >
                      Clear Filters
                    </Button>
                  ) : (
                    <Button
                      onClick={() => setShowCreateDialog(true)}
                      className="bg-[#FF9900] hover:bg-[#FA8900] text-black border border-[#A88734]"
                    >
                      <PlusIcon className="w-4 h-4 mr-2" />
                      Create Profile
                    </Button>
                  )}
                </div>
              ) : (
                <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(280px,1fr))]">
                  {displayProfiles.map((profile) => (
                    <BrowserProfileCard
                      key={profile.id}
                      profile={profile}
                      isRunning={runningProfiles.has(profile.id)}
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

          {activeTab === 'proxies' && <ProxyPoolPanel />}

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
