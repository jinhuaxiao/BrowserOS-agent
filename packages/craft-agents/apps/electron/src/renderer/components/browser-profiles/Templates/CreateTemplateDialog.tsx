/**
 * Create Template Dialog Component
 *
 * Dialog for creating a new profile template.
 */

import { XIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import type {
  CreateTemplateInput,
  EcommercePlatform,
  ProfileGroup,
  ProfileTemplate,
  ProxyRegion,
} from '../../../../shared/types'
import { ProxySelector } from '../ProxyManagement/ProxySelector'

interface CreateTemplateDialogProps {
  onClose: () => void
  onCreated: (template: ProfileTemplate) => void
}

const PLATFORMS: { value: EcommercePlatform; label: string }[] = [
  { value: 'amazon', label: 'Amazon' },
  { value: 'ebay', label: 'eBay' },
  { value: 'shopee', label: 'Shopee' },
  { value: 'lazada', label: 'Lazada' },
  { value: 'aliexpress', label: 'AliExpress' },
  { value: 'wish', label: 'Wish' },
  { value: 'etsy', label: 'Etsy' },
  { value: 'walmart', label: 'Walmart' },
  { value: 'mercadolibre', label: 'MercadoLibre' },
  { value: 'other', label: 'Other' },
]

const REGIONS: { value: ProxyRegion; label: string }[] = [
  { value: 'us', label: 'United States' },
  { value: 'eu', label: 'Europe' },
  { value: 'asia', label: 'Asia' },
  { value: 'oceania', label: 'Oceania' },
]

const OS_PLATFORMS = [
  { value: 'windows', label: 'Windows' },
  { value: 'macos', label: 'macOS' },
  { value: 'linux', label: 'Linux' },
]

export function CreateTemplateDialog({
  onClose,
  onCreated,
}: CreateTemplateDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [groups, setGroups] = useState<ProfileGroup[]>([])

  // Form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [platform, setPlatform] = useState<EcommercePlatform | ''>('')
  const [targetPlatform, setTargetPlatform] = useState<
    'windows' | 'macos' | 'linux' | ''
  >('')
  const [targetRegion, setTargetRegion] = useState<ProxyRegion | ''>('')
  const [proxyId, setProxyId] = useState<string | undefined>(undefined)
  const [groupId, setGroupId] = useState<string | ''>('')
  const [startupUrl, setStartupUrl] = useState('')
  const [tags, setTags] = useState('')

  // Load groups
  useEffect(() => {
    async function loadGroups() {
      try {
        const data = await window.electronAPI.listProfileGroups()
        setGroups(data)
      } catch (err) {
        console.error('Failed to load groups:', err)
      }
    }
    loadGroups()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      setError('Template name is required')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const input: CreateTemplateInput = {
        name: name.trim(),
        description: description.trim() || undefined,
        platform: platform || undefined,
        targetPlatform: targetPlatform || undefined,
        targetRegion: targetRegion || undefined,
        proxyId,
        groupId: groupId || undefined,
        startupUrl: startupUrl.trim() || undefined,
        tags: tags.trim()
          ? tags
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean)
          : undefined,
      }

      const template = await window.electronAPI.createProfileTemplate(input)
      onCreated(template)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create template')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-serif font-medium text-foreground">
            Create Template
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
          {/* Basic Info */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Template Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Amazon US Seller"
              className="w-full rounded-md border border-border bg-background px-3 py-2 focus:border-foreground focus:ring-1 focus:ring-foreground outline-none"
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this template for?"
              rows={2}
              className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 focus:border-foreground focus:ring-1 focus:ring-foreground outline-none"
              disabled={isLoading}
            />
          </div>

          {/* Platform selection */}
          <div>
            <label className="block text-sm font-medium mb-1">
              E-commerce Platform
            </label>
            <select
              value={platform}
              onChange={(e) =>
                setPlatform(e.target.value as EcommercePlatform | '')
              }
              className="w-full rounded-md border border-border bg-background px-3 py-2 focus:border-foreground focus:ring-1 focus:ring-foreground outline-none"
              disabled={isLoading}
            >
              <option value="">Any platform</option>
              {PLATFORMS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          {/* Fingerprint Options */}
          <div className="border-t pt-4">
            <h3 className="text-sm font-medium mb-3">Fingerprint Defaults</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-foreground/50 mb-1">
                  Operating System
                </label>
                <select
                  value={targetPlatform}
                  onChange={(e) =>
                    setTargetPlatform(
                      e.target.value as 'windows' | 'macos' | 'linux' | '',
                    )
                  }
                  className="w-full rounded-md border border-border bg-background px-3 py-2 focus:border-foreground focus:ring-1 focus:ring-foreground outline-none"
                  disabled={isLoading}
                >
                  <option value="">Random</option>
                  {OS_PLATFORMS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-foreground/50 mb-1">
                  Region
                </label>
                <select
                  value={targetRegion}
                  onChange={(e) =>
                    setTargetRegion(e.target.value as ProxyRegion | '')
                  }
                  className="w-full rounded-md border border-border bg-background px-3 py-2 focus:border-foreground focus:ring-1 focus:ring-foreground outline-none"
                  disabled={isLoading}
                >
                  <option value="">Random</option>
                  {REGIONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Proxy */}
          <div className="border-t pt-4">
            <label className="block text-sm font-medium mb-1">
              Default Proxy
            </label>
            <ProxySelector
              value={proxyId}
              onChange={setProxyId}
              disabled={isLoading}
            />
          </div>

          {/* Group */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Default Group
            </label>
            <select
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 focus:border-foreground focus:ring-1 focus:ring-foreground outline-none"
              disabled={isLoading}
            >
              <option value="">No group</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>

          {/* Startup URL */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Startup URL
            </label>
            <input
              type="url"
              value={startupUrl}
              onChange={(e) => setStartupUrl(e.target.value)}
              placeholder="https://www.amazon.com"
              className="w-full rounded-md border border-border bg-background px-3 py-2 focus:border-foreground focus:ring-1 focus:ring-foreground outline-none"
              disabled={isLoading}
            />
            <p className="text-xs text-foreground/50 mt-1">
              Browser will automatically navigate to this URL on launch
            </p>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Tags (comma-separated)
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="e.g., seller, premium"
              className="w-full rounded-md border border-border bg-background px-3 py-2 focus:border-foreground focus:ring-1 focus:ring-foreground outline-none"
              disabled={isLoading}
            />
          </div>

          {/* Error */}
          {error && (
            <div className="text-sm text-destructive p-2 bg-destructive/10 rounded">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t border-border">
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
              className="bg-foreground text-background hover:bg-foreground/90"
            >
              {isLoading ? 'Creating...' : 'Create Template'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
