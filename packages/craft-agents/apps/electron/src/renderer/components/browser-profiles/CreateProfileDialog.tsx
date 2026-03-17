/**
 * Create Profile Dialog Component
 *
 * Dialog for creating a new browser profile.
 * Supports proxy pool selection, groups, templates, and startup URL.
 */

import {
  AlertCircleIcon,
  GlobeIcon,
  LayoutTemplateIcon,
  Loader2Icon,
  MapPinIcon,
  XIcon,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useTeamSession } from '@/contexts/TeamContext'
import { usePermissions } from '@/hooks/use-permissions'
import type {
  BrowserProfileConfig,
  BrowserType,
  CreateProfileInput,
  EcommercePlatform,
  Member,
  ProfileGroup,
  ProfileTemplate,
  SavedProxy,
} from '../../../shared/types'
import { ProxySelector } from './ProxyManagement/ProxySelector'

// Get country flag emoji from country code
function getCountryFlag(countryCode: string): string {
  const code = countryCode.toUpperCase()
  if (code.length !== 2) return '🌍'
  const codePoints = code
    .split('')
    .map((char) => 0x1f1e6 + char.charCodeAt(0) - 'A'.charCodeAt(0))
  return String.fromCodePoint(...codePoints)
}

interface CreateProfileDialogProps {
  onClose: () => void
  onCreated: (profile: BrowserProfileConfig) => void
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

const REGIONS = [
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

const BROWSER_ENGINES: {
  value: BrowserType | 'default'
  label: string
  description: string
}[] = [
  {
    value: 'default',
    label: 'Nova Seller (Default)',
    description: 'Chromium-based fingerprint browser',
  },
  {
    value: 'zen-browser',
    label: 'Zen Browser',
    description: 'Firefox-based fingerprint browser with sidebar tabs',
  },
]

export function CreateProfileDialog({
  onClose,
  onCreated,
}: CreateProfileDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [groups, setGroups] = useState<ProfileGroup[]>([])
  const [templates, setTemplates] = useState<ProfileTemplate[]>([])
  const [members, setMembers] = useState<Omit<Member, 'passwordHash'>[]>([])

  // Team context
  const permissions = usePermissions()
  const session = useTeamSession()

  // Form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [platform, setPlatform] = useState<EcommercePlatform>('other')
  const [targetPlatform, setTargetPlatform] = useState<
    'windows' | 'macos' | 'linux'
  >('windows')
  const [targetRegion, setTargetRegion] = useState<
    'us' | 'eu' | 'asia' | 'oceania'
  >('us')
  const [tags, setTags] = useState('')
  const [browserEngine, setBrowserEngine] = useState<BrowserType | 'default'>(
    'default',
  )

  // New fields
  const [proxyId, setProxyId] = useState<string | undefined>(undefined)
  const [groupId, setGroupId] = useState<string>('')
  const [startupUrl, setStartupUrl] = useState('')
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')

  // Assignment state
  const [assignToMemberId, setAssignToMemberId] = useState<string>('')
  const [assignPermission, setAssignPermission] = useState<
    'full' | 'launch-only' | 'view-only'
  >('full')

  // Proxy geo detection state
  const [selectedProxy, setSelectedProxy] = useState<SavedProxy | null>(null)
  const [isDetectingGeo, setIsDetectingGeo] = useState(false)
  const [geoError, setGeoError] = useState<string | null>(null)

  // Load groups, templates, and members
  useEffect(() => {
    async function loadData() {
      try {
        const promises: Promise<unknown>[] = [
          window.electronAPI.listProfileGroups(),
          window.electronAPI.listProfileTemplates(),
        ]
        if (session?.organization?.id && permissions.canAssignProfiles) {
          promises.push(
            window.electronAPI.teamListMembers(session.organization.id),
          )
        }
        const results = await Promise.all(promises)
        setGroups(results[0] as ProfileGroup[])
        setTemplates(results[1] as ProfileTemplate[])
        if (results[2]) {
          setMembers(results[2] as Omit<Member, 'passwordHash'>[])
        }
      } catch (err) {
        console.error('Failed to load groups/templates:', err)
      }
    }
    loadData()
  }, [session?.organization?.id, permissions.canAssignProfiles])

  // Handle proxy selection change
  const handleProxyChange = async (newProxyId: string | undefined) => {
    setProxyId(newProxyId)
    setGeoError(null)

    if (!newProxyId) {
      setSelectedProxy(null)
      return
    }

    // Fetch proxy details
    try {
      const proxy = await window.electronAPI.getProxy(newProxyId)
      setSelectedProxy(proxy)

      // If proxy doesn't have geoLocation, offer to detect it
      if (proxy && !proxy.geoLocation) {
        // Auto-detect geo when proxy is selected
        handleDetectGeo(newProxyId)
      }
    } catch (err) {
      console.error('Failed to fetch proxy:', err)
    }
  }

  // Detect proxy geolocation
  const handleDetectGeo = async (targetProxyId?: string) => {
    const id = targetProxyId || proxyId
    if (!id) return

    setIsDetectingGeo(true)
    setGeoError(null)

    try {
      const geoLocation = await window.electronAPI.detectProxyGeoLocation(id)
      if (geoLocation) {
        // Refresh proxy data
        const updatedProxy = await window.electronAPI.getProxy(id)
        setSelectedProxy(updatedProxy)
      } else {
        setGeoError(
          'Failed to detect location. Please check if the proxy is working.',
        )
      }
    } catch (err) {
      setGeoError(err instanceof Error ? err.message : 'Detection failed')
    } finally {
      setIsDetectingGeo(false)
    }
  }

  // Apply template
  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplateId(templateId)

    if (!templateId) return

    const template = templates.find((t) => t.id === templateId)
    if (!template) return

    // Apply template values
    if (template.platform) setPlatform(template.platform)
    if (template.targetPlatform) setTargetPlatform(template.targetPlatform)
    if (template.targetRegion) setTargetRegion(template.targetRegion)
    if (template.proxyId) {
      handleProxyChange(template.proxyId)
    }
    if (template.groupId) setGroupId(template.groupId)
    if (template.startupUrl) setStartupUrl(template.startupUrl)
    if (template.tags) setTags(template.tags.join(', '))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      setError('Profile name is required')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const input: CreateProfileInput = {
        name: name.trim(),
        description: description.trim() || undefined,
        platform,
        browserEngine: browserEngine !== 'default' ? browserEngine : undefined,
        targetPlatform,
        targetRegion,
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

      const profile = await window.electronAPI.createBrowserProfile(input)

      // Auto-assign profile to selected member
      if (
        assignToMemberId &&
        session?.organization?.id &&
        permissions.currentMemberId
      ) {
        try {
          await window.electronAPI.teamCreateProfileAssignment({
            profileId: profile.id,
            memberId: assignToMemberId,
            organizationId: session.organization.id,
            permissions: assignPermission,
            assignedBy: permissions.currentMemberId,
          })
        } catch (err) {
          console.error('Failed to assign profile:', err)
        }
      }

      onCreated(profile)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create profile')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-background shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b p-4">
          <h2 className="font-semibold text-lg">Create Browser Profile</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <XIcon className="h-4 w-4" />
          </Button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 p-4">
          {/* Template selector */}
          {templates.length > 0 && (
            <div className="rounded-lg bg-muted/50 p-3">
              <label className="mb-2 flex items-center gap-2 font-medium text-sm">
                <LayoutTemplateIcon className="h-4 w-4" />
                Start from Template
              </label>
              <select
                value={selectedTemplateId}
                onChange={(e) => handleTemplateChange(e.target.value)}
                className="w-full rounded-md border bg-background px-3 py-2"
                disabled={isLoading}
              >
                <option value="">Choose a template...</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                    {t.platform && ` (${t.platform})`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Basic Info */}
          <div>
            <label className="mb-1 block font-medium text-sm">
              Profile Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Amazon Store 1"
              className="w-full rounded-md border bg-background px-3 py-2"
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="mb-1 block font-medium text-sm">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description..."
              rows={2}
              className="w-full resize-none rounded-md border bg-background px-3 py-2"
              disabled={isLoading}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block font-medium text-sm">Platform</label>
              <select
                value={platform}
                onChange={(e) =>
                  setPlatform(e.target.value as EcommercePlatform)
                }
                className="w-full rounded-md border bg-background px-3 py-2"
                disabled={isLoading}
              >
                {PLATFORMS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block font-medium text-sm">Group</label>
              <select
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
                className="w-full rounded-md border bg-background px-3 py-2"
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
          </div>

          {/* Browser Engine */}
          <div>
            <label className="mb-1 block font-medium text-sm">
              Browser Engine
            </label>
            <select
              value={browserEngine}
              onChange={(e) =>
                setBrowserEngine(e.target.value as BrowserType | 'default')
              }
              className="w-full rounded-md border bg-background px-3 py-2"
              disabled={isLoading}
            >
              {BROWSER_ENGINES.map((engine) => (
                <option key={engine.value} value={engine.value}>
                  {engine.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-muted-foreground text-xs">
              {
                BROWSER_ENGINES.find((e) => e.value === browserEngine)
                  ?.description
              }
            </p>
          </div>

          {/* Fingerprint Options */}
          <div className="border-t pt-4">
            <h3 className="mb-3 font-medium text-sm">Fingerprint Options</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-muted-foreground text-sm">
                  Operating System
                </label>
                <select
                  value={targetPlatform}
                  onChange={(e) =>
                    setTargetPlatform(
                      e.target.value as 'windows' | 'macos' | 'linux',
                    )
                  }
                  className="w-full rounded-md border bg-background px-3 py-2"
                  disabled={isLoading}
                >
                  {OS_PLATFORMS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-muted-foreground text-sm">
                  Region
                  {selectedProxy?.geoLocation && (
                    <span className="ml-1 text-green-600 text-xs">
                      (auto from proxy)
                    </span>
                  )}
                </label>
                <select
                  value={targetRegion}
                  onChange={(e) =>
                    setTargetRegion(
                      e.target.value as 'us' | 'eu' | 'asia' | 'oceania',
                    )
                  }
                  className={`w-full rounded-md border bg-background px-3 py-2 ${
                    selectedProxy?.geoLocation ? 'opacity-50' : ''
                  }`}
                  disabled={isLoading || !!selectedProxy?.geoLocation}
                  title={
                    selectedProxy?.geoLocation
                      ? 'Region will be auto-detected from proxy IP'
                      : ''
                  }
                >
                  {REGIONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Proxy Configuration */}
          <div className="border-t pt-4">
            <label className="mb-2 block font-medium text-sm">Proxy</label>
            <ProxySelector
              value={proxyId}
              onChange={handleProxyChange}
              disabled={isLoading}
            />

            {/* Proxy Geolocation Info */}
            {selectedProxy && (
              <div className="mt-3 rounded-lg bg-muted/50 p-3">
                {isDetectingGeo ? (
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <Loader2Icon className="h-4 w-4 animate-spin" />
                    <span>Detecting IP environment...</span>
                  </div>
                ) : selectedProxy.geoLocation ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">
                        {getCountryFlag(selectedProxy.geoLocation.country)}
                      </span>
                      <div>
                        <div className="font-medium text-sm">
                          {selectedProxy.geoLocation.city}
                          {selectedProxy.geoLocation.region &&
                            `, ${selectedProxy.geoLocation.region}`}
                        </div>
                        <div className="text-muted-foreground text-xs">
                          {selectedProxy.geoLocation.countryName}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">
                          Timezone:{' '}
                        </span>
                        <span className="font-medium">
                          {selectedProxy.geoLocation.timezone}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">IP: </span>
                        <span className="font-mono">
                          {selectedProxy.geoLocation.ip}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 rounded bg-green-50 px-2 py-1 text-green-600 text-xs">
                      <GlobeIcon className="h-3 w-3" />
                      <span>
                        Fingerprint will auto-match this location (timezone,
                        language)
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDetectGeo()}
                      disabled={isDetectingGeo}
                      className="text-xs"
                    >
                      <MapPinIcon className="mr-1 h-3 w-3" />
                      Refresh Location
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-amber-600 text-sm">
                      <AlertCircleIcon className="h-4 w-4" />
                      <span>IP environment not detected yet</span>
                    </div>
                    {geoError && (
                      <div className="text-red-500 text-xs">{geoError}</div>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleDetectGeo()}
                      disabled={isDetectingGeo}
                    >
                      <MapPinIcon className="mr-1 h-4 w-4" />
                      Detect IP Environment
                    </Button>
                    <p className="text-muted-foreground text-xs">
                      Detecting will set the fingerprint timezone/language to
                      match the proxy's location
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Startup URL */}
          <div>
            <label className="mb-1 block font-medium text-sm">
              Startup URL
            </label>
            <input
              type="url"
              value={startupUrl}
              onChange={(e) => setStartupUrl(e.target.value)}
              placeholder="https://www.amazon.com"
              className="w-full rounded-md border bg-background px-3 py-2"
              disabled={isLoading}
            />
            <p className="mt-1 text-muted-foreground text-xs">
              Browser will automatically navigate to this URL on launch
            </p>
          </div>

          {/* Tags */}
          <div>
            <label className="mb-1 block font-medium text-sm">
              Tags (comma-separated)
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="e.g., usa, main, test"
              className="w-full rounded-md border bg-background px-3 py-2"
              disabled={isLoading}
            />
          </div>

          {/* Assign to member */}
          {permissions.canAssignProfiles && members.length > 0 && (
            <div className="border-t pt-4">
              <label className="mb-2 block font-medium text-sm">
                Assign to Member
              </label>
              <div className="grid grid-cols-2 gap-4">
                <select
                  value={assignToMemberId}
                  onChange={(e) => setAssignToMemberId(e.target.value)}
                  className="w-full rounded-md border bg-background px-3 py-2"
                  disabled={isLoading}
                >
                  <option value="">No assignment</option>
                  {members
                    .filter((m) => m.status === 'active')
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.displayName} ({m.role})
                      </option>
                    ))}
                </select>
                {assignToMemberId && (
                  <select
                    value={assignPermission}
                    onChange={(e) =>
                      setAssignPermission(
                        e.target.value as 'full' | 'launch-only' | 'view-only',
                      )
                    }
                    className="w-full rounded-md border bg-background px-3 py-2"
                    disabled={isLoading}
                  >
                    <option value="full">Full Access</option>
                    <option value="launch-only">Launch Only</option>
                    <option value="view-only">View Only</option>
                  </select>
                )}
              </div>
              <p className="mt-1 text-muted-foreground text-xs">
                Optionally assign this profile to a team member on creation
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="rounded bg-red-500/10 p-2 text-red-500 text-sm">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 border-t pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Creating...' : 'Create Profile'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
