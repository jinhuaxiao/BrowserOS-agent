/**
 * Create Group Dialog Component
 *
 * Dialog for creating a new profile group.
 */

import { XIcon } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import type { CreateGroupInput, ProfileGroup } from '../../../../shared/types'

interface CreateGroupDialogProps {
  onClose: () => void
  onCreated: (group: ProfileGroup) => void
}

const PRESET_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#f59e0b', // amber
  '#84cc16', // lime
  '#22c55e', // green
  '#14b8a6', // teal
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#a855f7', // purple
  '#ec4899', // pink
]

export function CreateGroupDialog({
  onClose,
  onCreated,
}: CreateGroupDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState(
    PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)],
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      setError('Group name is required')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const input: CreateGroupInput = {
        name: name.trim(),
        description: description.trim() || undefined,
        color,
      }

      const group = await window.electronAPI.createProfileGroup(input)
      onCreated(group)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create group')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-sm">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-serif font-medium text-foreground">
            Create Group
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-foreground/50 hover:bg-foreground/5 hover:text-foreground"
          >
            <XIcon className="w-4 h-4" />
          </Button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Group Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Amazon US"
              className="w-full rounded-md border border-border bg-background px-3 py-2 focus:border-accent focus:ring-1 focus:ring-accent outline-none"
              disabled={isLoading}
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description..."
              rows={2}
              className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 focus:border-accent focus:ring-1 focus:ring-accent outline-none"
              disabled={isLoading}
            />
          </div>

          {/* Color picker */}
          <div>
            <label className="block text-sm font-medium mb-2">Color</label>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map((presetColor) => (
                <button
                  key={presetColor}
                  type="button"
                  onClick={() => setColor(presetColor)}
                  className={`w-8 h-8 rounded-full transition-transform ${
                    color === presetColor
                      ? 'ring-2 ring-offset-2 ring-accent scale-110'
                      : 'hover:scale-110'
                  }`}
                  style={{ backgroundColor: presetColor }}
                  disabled={isLoading}
                />
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="flex items-center gap-2 p-3 bg-foreground/5 rounded-md">
            <div
              className="w-4 h-4 rounded-full"
              style={{ backgroundColor: color }}
            />
            <span className="font-medium">{name || 'Group Name'}</span>
          </div>

          {/* Error */}
          {error && (
            <div className="text-sm text-red-500 p-2 bg-red-500/10 rounded">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2 border-t border-border mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
              className="border-border hover:bg-foreground/5"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="bg-accent text-white hover:bg-accent/90"
            >
              {isLoading ? 'Creating...' : 'Create Group'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
