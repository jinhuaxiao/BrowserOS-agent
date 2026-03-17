/**
 * Group Sidebar Component
 *
 * Sidebar for navigating and managing profile groups.
 */

import {
  FolderIcon,
  FolderOpenIcon,
  Loader2Icon,
  PlusIcon,
  Trash2Icon,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import type { ProfileGroup } from '../../../../shared/types'
import { CreateGroupDialog } from './CreateGroupDialog'

interface GroupSidebarProps {
  selectedGroupId: string | null // null means "All Profiles"
  onSelectGroup: (groupId: string | null) => void
}

interface GroupWithCount extends ProfileGroup {
  profileCount: number
}

export function GroupSidebar({
  selectedGroupId,
  onSelectGroup,
}: GroupSidebarProps) {
  const [groups, setGroups] = useState<GroupWithCount[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [deletingGroupId, setDeletingGroupId] = useState<string | null>(null)
  const [totalProfiles, setTotalProfiles] = useState(0)
  const [ungroupedCount, setUngroupedCount] = useState(0)
  const [trashCount, setTrashCount] = useState(0)

  // Load groups and profile counts
  const loadGroups = useCallback(async () => {
    try {
      const [groupList, allProfiles] = await Promise.all([
        window.electronAPI.listProfileGroups(),
        window.electronAPI.listBrowserProfiles(),
      ])

      // Calculate profile counts
      const groupsWithCount = groupList.map((group) => ({
        ...group,
        profileCount: allProfiles.filter((p) => p.groupId === group.id).length,
      }))

      setGroups(groupsWithCount)
      setTotalProfiles(allProfiles.length)
      setUngroupedCount(allProfiles.filter((p) => !p.groupId).length)

      // Load trash count
      try {
        const count = await window.electronAPI.getTrashCount()
        setTrashCount(count)
      } catch {
        // Trash count is best-effort
      }
    } catch (err) {
      console.error('Failed to load groups:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadGroups()
  }, [loadGroups])

  // Handle group created
  const handleGroupCreated = (group: ProfileGroup) => {
    setGroups((prev) => [...prev, { ...group, profileCount: 0 }])
    setShowCreateDialog(false)
  }

  // Handle group delete
  const handleDeleteGroup = async (groupId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setDeletingGroupId(groupId)

    try {
      await window.electronAPI.deleteProfileGroup(groupId)
      setGroups((prev) => prev.filter((g) => g.id !== groupId))

      // If we deleted the selected group, go back to All Profiles
      if (selectedGroupId === groupId) {
        onSelectGroup(null)
      }

      // Reload to update ungrouped count
      loadGroups()
    } catch (err) {
      console.error('Failed to delete group:', err)
    } finally {
      setDeletingGroupId(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2Icon className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header - titlebar-drag-region for window dragging, button opts out */}
      <div className="titlebar-drag-region relative z-overlay flex items-center justify-between border-b p-3">
        <h3 className="font-medium text-sm">Groups</h3>
        <button
          type="button"
          onClick={() => setShowCreateDialog(true)}
          title="Create group"
          className="titlebar-no-drag rounded-md p-1.5 transition-colors hover:bg-muted"
        >
          <PlusIcon className="h-4 w-4" />
        </button>
      </div>

      {/* Group list */}
      <div className="flex-1 overflow-y-auto py-2">
        {/* All Profiles */}
        <button
          type="button"
          onClick={() => onSelectGroup(null)}
          className={`flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted/50 ${
            selectedGroupId === null ? 'bg-muted/50' : ''
          }`}
        >
          {selectedGroupId === null ? (
            <FolderOpenIcon className="h-4 w-4" />
          ) : (
            <FolderIcon className="h-4 w-4" />
          )}
          <span className="flex-1">All Profiles</span>
          <span className="text-muted-foreground text-xs">{totalProfiles}</span>
        </button>

        {/* Ungrouped */}
        <button
          type="button"
          onClick={() => onSelectGroup('ungrouped')}
          className={`flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted/50 ${
            selectedGroupId === 'ungrouped' ? 'bg-muted/50' : ''
          }`}
        >
          {selectedGroupId === 'ungrouped' ? (
            <FolderOpenIcon className="h-4 w-4 text-muted-foreground" />
          ) : (
            <FolderIcon className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="flex-1 text-muted-foreground">Ungrouped</span>
          <span className="text-muted-foreground text-xs">
            {ungroupedCount}
          </span>
        </button>

        {/* Divider */}
        {groups.length > 0 && <div className="mx-3 my-2 border-t" />}

        {/* Groups */}
        {groups.map((group) => (
          <button
            type="button"
            key={group.id}
            className={`group flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left hover:bg-muted/50 ${
              selectedGroupId === group.id ? 'bg-muted/50' : ''
            }`}
            onClick={() => onSelectGroup(group.id)}
          >
            {/* Color indicator */}
            <div
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: group.color || '#6b7280' }}
            />

            {/* Name */}
            <span className="flex-1 truncate">{group.name}</span>

            {/* Count */}
            <span className="text-muted-foreground text-xs">
              {group.profileCount}
            </span>

            {/* Delete button */}
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
              onClick={(e) => handleDeleteGroup(group.id, e)}
              disabled={deletingGroupId === group.id}
            >
              {deletingGroupId === group.id ? (
                <Loader2Icon className="h-3 w-3 animate-spin" />
              ) : (
                <Trash2Icon className="h-3 w-3" />
              )}
            </Button>
          </button>
        ))}

        {groups.length === 0 && (
          <p className="px-3 py-4 text-center text-muted-foreground text-xs">
            No groups yet. Create one to organize your profiles.
          </p>
        )}

        {/* Trash */}
        <div className="mx-3 mt-2 border-t pt-2">
          <button
            type="button"
            onClick={() => onSelectGroup('trash')}
            className={`flex w-full items-center gap-2 rounded px-3 py-2 text-left hover:bg-muted/50 ${
              selectedGroupId === 'trash' ? 'bg-muted/50' : ''
            }`}
          >
            <Trash2Icon className="h-4 w-4 text-muted-foreground" />
            <span className="flex-1 text-muted-foreground">Trash</span>
            {trashCount > 0 && (
              <span className="text-muted-foreground text-xs">
                {trashCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Create group dialog */}
      {showCreateDialog && (
        <CreateGroupDialog
          onClose={() => setShowCreateDialog(false)}
          onCreated={handleGroupCreated}
        />
      )}
    </div>
  )
}
