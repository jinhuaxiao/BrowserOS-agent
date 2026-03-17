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
      <div className="flex items-center justify-center h-64">
        <Loader2Icon className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center bg-white rounded border border-[#D5D9D9] p-8">
        <Trash2Icon className="w-12 h-12 text-[#D5D9D9] mb-4" />
        <div className="text-[#565959] mb-2">Trash is empty</div>
        <p className="text-xs text-[#565959]">
          Deleted profiles will appear here for 30 days before being permanently
          removed.
        </p>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <AlertTriangleIcon className="w-4 h-4 text-amber-500" />
          <span className="text-sm text-[#565959]">
            {items.length} profile{items.length !== 1 ? 's' : ''} in trash
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleEmptyTrash}
          disabled={actionId === 'empty'}
          className="text-[#B12704] border-[#D5D9D9] hover:bg-red-50"
        >
          {actionId === 'empty' ? (
            <Loader2Icon className="w-4 h-4 mr-1 animate-spin" />
          ) : (
            <Trash2Icon className="w-4 h-4 mr-1" />
          )}
          Empty Trash
        </Button>
      </div>

      {/* Items */}
      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={item.profileId}
            className="flex items-center justify-between bg-white rounded border border-[#D5D9D9] p-3 shadow-sm"
          >
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm text-[#0F1111] truncate">
                {item.profileName}
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs text-[#565959]">
                <span>
                  Deleted {new Date(item.deletedAt).toLocaleDateString()}
                </span>
                <span className="text-amber-600">
                  {getRemainingDays(item.autoDeleteAt)} days remaining
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 ml-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleRestore(item.profileId)}
                disabled={actionId === item.profileId}
                className="text-[#007185] border-[#D5D9D9] hover:bg-blue-50"
              >
                {actionId === item.profileId ? (
                  <Loader2Icon className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RotateCcwIcon className="w-3.5 h-3.5 mr-1" />
                )}
                Restore
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handlePermanentDelete(item.profileId)}
                disabled={actionId === item.profileId}
                className="text-[#B12704] hover:bg-red-50"
              >
                <Trash2Icon className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
