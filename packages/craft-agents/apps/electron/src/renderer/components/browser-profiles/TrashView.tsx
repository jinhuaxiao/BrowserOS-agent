import {
  AlertTriangleIcon,
  Loader2Icon,
  RotateCcwIcon,
  Trash2Icon,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'

interface TrashItem {
  profileId: string
  profileName: string
  deletedAt: number
  autoDeleteAt: number
  originalGroupId?: string
}

export function TrashView() {
  const [items, setItems] = useState<TrashItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [actionId, setActionId] = useState<string | null>(null)

  const loadItems = useCallback(async () => {
    try {
      const list = await window.electronAPI.listTrashItems()
      setItems(list)
    } catch (err) {
      console.error('Failed to load trash items:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadItems()
  }, [loadItems])

  const handleRestore = async (profileId: string) => {
    setActionId(profileId)
    try {
      const restored = await window.electronAPI.restoreTrashProfile(profileId)
      if (restored) {
        setItems((prev) => prev.filter((i) => i.profileId !== profileId))
      }
    } catch (err) {
      console.error('Failed to restore profile:', err)
    } finally {
      setActionId(null)
    }
  }

  const handlePermanentDelete = async (profileId: string) => {
    if (
      !confirm(
        'This will permanently delete the profile and all its data. Continue?',
      )
    )
      return
    setActionId(profileId)
    try {
      const deleted =
        await window.electronAPI.permanentDeleteTrashProfile(profileId)
      if (deleted) {
        setItems((prev) => prev.filter((i) => i.profileId !== profileId))
      }
    } catch (err) {
      console.error('Failed to permanently delete profile:', err)
    } finally {
      setActionId(null)
    }
  }

  const handleEmptyTrash = async () => {
    if (!confirm(`Permanently delete all ${items.length} profiles in trash?`))
      return
    setActionId('empty')
    try {
      await window.electronAPI.emptyTrash()
      setItems([])
    } catch (err) {
      console.error('Failed to empty trash:', err)
    } finally {
      setActionId(null)
    }
  }

  const getRemainingDays = (autoDeleteAt: number) => {
    const remaining = autoDeleteAt - Date.now()
    return Math.max(0, Math.ceil(remaining / (24 * 60 * 60 * 1000)))
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2Icon className="h-5 w-5 animate-spin text-foreground/50" />
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-border bg-card p-8 text-center">
        <Trash2Icon className="mb-4 h-12 w-12 text-foreground/50" />
        <div className="mb-2 text-foreground/50">Trash is empty</div>
        <p className="text-foreground/50 text-xs">
          Deleted profiles will appear here for 30 days before being permanently
          removed.
        </p>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangleIcon className="h-4 w-4 text-amber-500" />
          <span className="text-foreground/50 text-sm">
            {items.length} profile{items.length !== 1 ? 's' : ''} in trash
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleEmptyTrash}
          disabled={actionId === 'empty'}
          className="border-border text-destructive hover:bg-destructive/10"
        >
          {actionId === 'empty' ? (
            <Loader2Icon className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <Trash2Icon className="mr-1 h-4 w-4" />
          )}
          Empty Trash
        </Button>
      </div>

      {/* Items */}
      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={item.profileId}
            className="flex items-center justify-between rounded-xl border border-border bg-card p-4 shadow-minimal"
          >
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium text-foreground text-sm">
                {item.profileName}
              </div>
              <div className="mt-1 flex items-center gap-3 text-foreground/50 text-xs">
                <span>
                  Deleted {new Date(item.deletedAt).toLocaleDateString()}
                </span>
                <span className="text-amber-600">
                  {getRemainingDays(item.autoDeleteAt)} days remaining
                </span>
              </div>
            </div>

            <div className="ml-4 flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleRestore(item.profileId)}
                disabled={actionId === item.profileId}
                className="border-border text-foreground hover:bg-foreground/5"
              >
                {actionId === item.profileId ? (
                  <Loader2Icon className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RotateCcwIcon className="mr-1 h-3.5 w-3.5" />
                )}
                Restore
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handlePermanentDelete(item.profileId)}
                disabled={actionId === item.profileId}
                className="text-destructive hover:bg-destructive/10"
              >
                <Trash2Icon className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
