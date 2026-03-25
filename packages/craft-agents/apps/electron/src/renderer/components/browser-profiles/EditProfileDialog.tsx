/**
 * Edit Profile Dialog Component
 *
 * Dialog for editing an existing browser profile.
 * Supports updating name, description, platform, proxy, group, startup URL, and tags.
 */

import {
  AlertCircleIcon,
  GlobeIcon,
  Loader2Icon,
  MapPinIcon,
  RefreshCwIcon,
  XIcon,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import type {
  BrowserProfileConfig,
  BrowserType,
  EcommercePlatform,
  ProfileGroup,
  SavedProxy,
  UpdateProfileInput,
} from '../../../shared/types'
import { CookieImportPanel } from './CookieImportPanel'
import { ProxySelector } from './ProxyManagement/ProxySelector'

// Get country flag emoji from country code
function getCountryFlag(countryCode: string): string {
  const code = countryCode.toUpperCase()
  if (code.length !== 2) return ''
  const codePoints = code
    .split('')
    .map((char) => 0x1f1e6 + char.charCodeAt(0) - 'A'.charCodeAt(0))
  return String.fromCodePoint(...codePoints)
}

interface EditProfileDialogProps {
  profile: BrowserProfileConfig
  onClose: () => void
  onUpdated: (profile: BrowserProfileConfig) => void
}

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

export function EditProfileDialog({
  profile,
  onClose,
  onUpdated,
}: EditProfileDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [groups, setGroups] = useState<ProfileGroup[]>([])

  // Form state - initialized from profile
  const [name, setName] = useState(profile.name)
  const [description, setDescription] = useState(profile.description || '')
  const [platform, setPlatform] = useState<EcommercePlatform>(
    profile.platform || 'other',
  )
  const [browserEngine, setBrowserEngine] = useState<BrowserType | 'default'>(
    profile.browserEngine || 'default',
  )
  const [tags, setTags] = useState(profile.tags?.join(', ') || '')

  // Proxy and group
  const [proxyId, setProxyId] = useState<string | undefined>(profile.proxyId)
  const [accelerated, setAccelerated] = useState(profile.accelerated ?? false)
  const [groupId, setGroupId] = useState<string>(profile.groupId || '')
  const [startupUrl, setStartupUrl] = useState(profile.startupUrl || '')

  // Proxy geo detection state
  const [selectedProxy, setSelectedProxy] = useState<SavedProxy | null>(null)
  const [isDetectingGeo, setIsDetectingGeo] = useState(false)
  const [geoError, setGeoError] = useState<string | null>(null)

  // Fingerprint state - track current fingerprint for live updates
  const [currentFingerprint, setCurrentFingerprint] = useState(
    profile.fingerprint,
  )
  const [isRegeneratingFingerprint, setIsRegeneratingFingerprint] =
    useState(false)

  // Load groups
  useEffect(() => {
    async function loadData() {
      try {
        const groupList = await window.electronAPI.listProfileGroups()
        setGroups(groupList)
      } catch (err) {
        console.error('Failed to load groups:', err)
      }
    }
    loadData()
  }, [])

  // Load initial proxy details if proxyId exists
  useEffect(() => {
    async function loadProxy() {
      if (profile.proxyId) {
        try {
          const proxy = await window.electronAPI.getProxy(profile.proxyId)
          setSelectedProxy(proxy)
        } catch (err) {
          console.error('Failed to load proxy:', err)
        }
      }
    }
    loadProxy()
  }, [profile.proxyId])

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

  // Regenerate fingerprint with matching proxy location
  const handleRegenerateFingerprint = async () => {
    setIsRegeneratingFingerprint(true)
    setError(null)

    try {
      // First save any pending changes (especially proxyId) so regeneration uses correct proxy
      if (proxyId !== profile.proxyId) {
        await window.electronAPI.updateBrowserProfile(profile.id, { proxyId })
      }

      // Regenerate fingerprint - it will automatically match proxy's geolocation
      const updatedProfile =
        await window.electronAPI.regenerateBrowserFingerprint(profile.id)
      if (updatedProfile) {
        setCurrentFingerprint(updatedProfile.fingerprint)
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to regenerate fingerprint',
      )
    } finally {
      setIsRegeneratingFingerprint(false)
    }
  }

  // Check if fingerprint timezone mismatches proxy timezone
  const hasFingerprintMismatch =
    selectedProxy?.geoLocation?.timezone &&
    currentFingerprint.timezone?.name !== selectedProxy.geoLocation.timezone

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      setError('Profile name is required')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const input: UpdateProfileInput = {
        name: name.trim(),
        description: description.trim() || undefined,
        platform,
        browserEngine: browserEngine !== 'default' ? browserEngine : undefined,
        proxyId,
        accelerated,
        groupId: groupId || undefined,
        startupUrl: startupUrl.trim() || undefined,
        tags: tags.trim()
          ? tags
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean)
          : undefined,
      }

      const updatedProfile = await window.electronAPI.updateBrowserProfile(
        profile.id,
        input,
      )

      // If browserEngine changed, auto-regenerate fingerprint to match the new engine
      const oldEngine = profile.browserEngine || undefined
      const newEngine = browserEngine !== 'default' ? browserEngine : undefined
      if (updatedProfile && oldEngine !== newEngine) {
        const regenerated =
          await window.electronAPI.regenerateBrowserFingerprint(profile.id)
        if (regenerated) {
          onUpdated(regenerated)
          return
        }
      }

      if (updatedProfile) {
        onUpdated(updatedProfile)
      } else {
        setError('Failed to update profile')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-background shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="font-serif font-medium text-lg text-foreground">
            Edit Profile
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-foreground/50 hover:bg-foreground/5 hover:text-foreground"
          >
            <XIcon className="h-4 w-4" />
          </Button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 p-4">
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
              className="w-full rounded-md border border-border bg-background px-3 py-2 focus:border-accent focus:ring-1 focus:ring-accent outline-none"
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
              className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 focus:border-accent focus:ring-1 focus:ring-accent outline-none"
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
                className="w-full rounded-md border border-border bg-background px-3 py-2 focus:border-accent focus:ring-1 focus:ring-accent outline-none"
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
                className="w-full rounded-md border border-border bg-background px-3 py-2 focus:border-accent focus:ring-1 focus:ring-accent outline-none"
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
              className="w-full rounded-md border border-border bg-background px-3 py-2 focus:border-accent focus:ring-1 focus:ring-accent outline-none"
              disabled={isLoading}
            >
              {BROWSER_ENGINES.map((engine) => (
                <option key={engine.value} value={engine.value}>
                  {engine.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-foreground/50 text-xs">
              {
                BROWSER_ENGINES.find((e) => e.value === browserEngine)
                  ?.description
              }
              {browserEngine !== (profile.browserEngine || 'default') && (
                <span className="ml-1 text-amber-600">
                  (changed - fingerprint will auto-regenerate on save)
                </span>
              )}
            </p>
          </div>

          {/* Fingerprint Info */}
          <div className="border-t pt-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-medium text-sm">Current Fingerprint</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRegenerateFingerprint}
                disabled={isLoading || isRegeneratingFingerprint}
                className="text-xs"
              >
                {isRegeneratingFingerprint ? (
                  <>
                    <Loader2Icon className="mr-1 h-3 w-3 animate-spin" />
                    Regenerating...
                  </>
                ) : (
                  <>
                    <RefreshCwIcon className="mr-1 h-3 w-3" />
                    Regenerate Fingerprint
                  </>
                )}
              </Button>
            </div>

            {/* Mismatch Warning */}
            {hasFingerprintMismatch && (
              <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs">
                <AlertCircleIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
                <div>
                  <p className="font-medium text-amber-800">
                    Timezone Mismatch Detected
                  </p>
                  <p className="text-amber-700">
                    Fingerprint:{' '}
                    <span className="font-mono">
                      {currentFingerprint.timezone?.name}
                    </span>{' '}
                    | Proxy:{' '}
                    <span className="font-mono">
                      {selectedProxy?.geoLocation?.timezone}
                    </span>
                  </p>
                  <p className="mt-1 text-amber-600">
                    Click "Regenerate Fingerprint" to match the proxy location.
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-1 rounded-lg bg-foreground/5 p-3 text-xs">
              <div className="flex">
                <span className="w-20 text-foreground/50">UA:</span>
                <span
                  className="flex-1 truncate"
                  title={currentFingerprint.navigator?.userAgent}
                >
                  {currentFingerprint.navigator?.userAgent?.slice(0, 50)}...
                </span>
              </div>
              <div className="flex">
                <span className="w-20 text-foreground/50">Screen:</span>
                <span>
                  {currentFingerprint.screen?.width}x
                  {currentFingerprint.screen?.height}
                </span>
              </div>
              <div className="flex">
                <span className="w-20 text-foreground/50">Timezone:</span>
                <span
                  className={
                    hasFingerprintMismatch ? 'font-medium text-amber-600' : ''
                  }
                >
                  {currentFingerprint.timezone?.name}
                </span>
              </div>
              <div className="flex">
                <span className="w-20 text-foreground/50">Language:</span>
                <span>{currentFingerprint.navigator?.language}</span>
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

            {/* Acceleration Toggle */}
            {proxyId && (
              <label className="mt-3 flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={accelerated}
                  onChange={(e) => setAccelerated(e.target.checked)}
                  className="rounded border-border"
                />
                <span className="text-sm">Enable acceleration</span>
                <span className="text-xs text-foreground/50">
                  Route through accelerator node for better cross-border
                  performance
                </span>
              </label>
            )}

            {/* Proxy Geolocation Info */}
            {selectedProxy && (
              <div className="mt-3 rounded-lg bg-foreground/5 p-3">
                {isDetectingGeo ? (
                  <div className="flex items-center gap-2 text-foreground/50 text-sm">
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
                        <div className="text-foreground/50 text-xs">
                          {selectedProxy.geoLocation.countryName}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-foreground/50">Timezone: </span>
                        <span className="font-medium">
                          {selectedProxy.geoLocation.timezone}
                        </span>
                      </div>
                      <div>
                        <span className="text-foreground/50">IP: </span>
                        <span className="font-mono">
                          {selectedProxy.geoLocation.ip}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 rounded bg-green-50 px-2 py-1 text-green-600 text-xs">
                      <GlobeIcon className="h-3 w-3" />
                      <span>
                        Fingerprint will auto-match this location on regenerate
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
              className="w-full rounded-md border border-border bg-background px-3 py-2 focus:border-accent focus:ring-1 focus:ring-accent outline-none"
              disabled={isLoading}
            />
            <p className="mt-1 text-foreground/50 text-xs">
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
              className="w-full rounded-md border border-border bg-background px-3 py-2 focus:border-accent focus:ring-1 focus:ring-accent outline-none"
              disabled={isLoading}
            />
          </div>

          {/* Cookie Import */}
          <CookieImportPanel profileId={profile.id} disabled={isLoading} />

          {/* Error */}
          {error && (
            <div className="rounded bg-red-500/10 p-2 text-red-500 text-sm">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 border-t border-border pt-4">
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
              {isLoading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
