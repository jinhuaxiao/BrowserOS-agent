/**
 * Edit Profile Dialog Component
 *
 * Dialog for editing an existing browser profile.
 * Supports updating name, description, platform, proxy, group, startup URL, and tags.
 */

import { useState, useEffect } from 'react';
import type {
  BrowserProfileConfig,
  UpdateProfileInput,
  EcommercePlatform,
  ProfileGroup,
  SavedProxy,
} from '../../../shared/types';
import { Button } from '@/components/ui/button';
import { XIcon, MapPinIcon, Loader2Icon, GlobeIcon, AlertCircleIcon, RefreshCwIcon } from 'lucide-react';
import { ProxySelector } from './ProxyManagement/ProxySelector';

// Get country flag emoji from country code
function getCountryFlag(countryCode: string): string {
  const code = countryCode.toUpperCase();
  if (code.length !== 2) return '';
  const codePoints = code
    .split('')
    .map((char) => 0x1f1e6 + char.charCodeAt(0) - 'A'.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

interface EditProfileDialogProps {
  profile: BrowserProfileConfig;
  onClose: () => void;
  onUpdated: (profile: BrowserProfileConfig) => void;
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
];

export function EditProfileDialog({ profile, onClose, onUpdated }: EditProfileDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [groups, setGroups] = useState<ProfileGroup[]>([]);

  // Form state - initialized from profile
  const [name, setName] = useState(profile.name);
  const [description, setDescription] = useState(profile.description || '');
  const [platform, setPlatform] = useState<EcommercePlatform>(profile.platform || 'other');
  const [tags, setTags] = useState(profile.tags?.join(', ') || '');

  // Proxy and group
  const [proxyId, setProxyId] = useState<string | undefined>(profile.proxyId);
  const [groupId, setGroupId] = useState<string>(profile.groupId || '');
  const [startupUrl, setStartupUrl] = useState(profile.startupUrl || '');

  // Proxy geo detection state
  const [selectedProxy, setSelectedProxy] = useState<SavedProxy | null>(null);
  const [isDetectingGeo, setIsDetectingGeo] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  // Fingerprint state - track current fingerprint for live updates
  const [currentFingerprint, setCurrentFingerprint] = useState(profile.fingerprint);
  const [isRegeneratingFingerprint, setIsRegeneratingFingerprint] = useState(false);

  // Load groups
  useEffect(() => {
    async function loadData() {
      try {
        const groupList = await window.electronAPI.listProfileGroups();
        setGroups(groupList);
      } catch (err) {
        console.error('Failed to load groups:', err);
      }
    }
    loadData();
  }, []);

  // Load initial proxy details if proxyId exists
  useEffect(() => {
    async function loadProxy() {
      if (profile.proxyId) {
        try {
          const proxy = await window.electronAPI.getProxy(profile.proxyId);
          setSelectedProxy(proxy);
        } catch (err) {
          console.error('Failed to load proxy:', err);
        }
      }
    }
    loadProxy();
  }, [profile.proxyId]);

  // Handle proxy selection change
  const handleProxyChange = async (newProxyId: string | undefined) => {
    setProxyId(newProxyId);
    setGeoError(null);

    if (!newProxyId) {
      setSelectedProxy(null);
      return;
    }

    // Fetch proxy details
    try {
      const proxy = await window.electronAPI.getProxy(newProxyId);
      setSelectedProxy(proxy);

      // If proxy doesn't have geoLocation, offer to detect it
      if (proxy && !proxy.geoLocation) {
        handleDetectGeo(newProxyId);
      }
    } catch (err) {
      console.error('Failed to fetch proxy:', err);
    }
  };

  // Detect proxy geolocation
  const handleDetectGeo = async (targetProxyId?: string) => {
    const id = targetProxyId || proxyId;
    if (!id) return;

    setIsDetectingGeo(true);
    setGeoError(null);

    try {
      const geoLocation = await window.electronAPI.detectProxyGeoLocation(id);
      if (geoLocation) {
        // Refresh proxy data
        const updatedProxy = await window.electronAPI.getProxy(id);
        setSelectedProxy(updatedProxy);
      } else {
        setGeoError('Failed to detect location. Please check if the proxy is working.');
      }
    } catch (err) {
      setGeoError(err instanceof Error ? err.message : 'Detection failed');
    } finally {
      setIsDetectingGeo(false);
    }
  };

  // Regenerate fingerprint with matching proxy location
  const handleRegenerateFingerprint = async () => {
    setIsRegeneratingFingerprint(true);
    setError(null);

    try {
      // First save any pending changes (especially proxyId) so regeneration uses correct proxy
      if (proxyId !== profile.proxyId) {
        await window.electronAPI.updateBrowserProfile(profile.id, { proxyId });
      }

      // Regenerate fingerprint - it will automatically match proxy's geolocation
      const updatedProfile = await window.electronAPI.regenerateBrowserFingerprint(profile.id);
      if (updatedProfile) {
        setCurrentFingerprint(updatedProfile.fingerprint);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to regenerate fingerprint');
    } finally {
      setIsRegeneratingFingerprint(false);
    }
  };

  // Check if fingerprint timezone mismatches proxy timezone
  const hasFingerprintMismatch = selectedProxy?.geoLocation?.timezone &&
    currentFingerprint.timezone?.name !== selectedProxy.geoLocation.timezone;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError('Profile name is required');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const input: UpdateProfileInput = {
        name: name.trim(),
        description: description.trim() || undefined,
        platform,
        proxyId,
        groupId: groupId || undefined,
        startupUrl: startupUrl.trim() || undefined,
        tags: tags.trim()
          ? tags.split(',').map((t) => t.trim()).filter(Boolean)
          : undefined,
      };

      const updatedProfile = await window.electronAPI.updateBrowserProfile(profile.id, input);
      if (updatedProfile) {
        onUpdated(updatedProfile);
      } else {
        setError('Failed to update profile');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Edit Profile</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <XIcon className="w-4 h-4" />
          </Button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Basic Info */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Profile Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Amazon Store 1"
              className="w-full px-3 py-2 border rounded-md bg-background"
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
              placeholder="Optional description..."
              rows={2}
              className="w-full px-3 py-2 border rounded-md bg-background resize-none"
              disabled={isLoading}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Platform
              </label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value as EcommercePlatform)}
                className="w-full px-3 py-2 border rounded-md bg-background"
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
              <label className="block text-sm font-medium mb-1">
                Group
              </label>
              <select
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
                className="w-full px-3 py-2 border rounded-md bg-background"
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

          {/* Fingerprint Info */}
          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium">Current Fingerprint</h3>
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
                    <Loader2Icon className="w-3 h-3 mr-1 animate-spin" />
                    Regenerating...
                  </>
                ) : (
                  <>
                    <RefreshCwIcon className="w-3 h-3 mr-1" />
                    Regenerate Fingerprint
                  </>
                )}
              </Button>
            </div>

            {/* Mismatch Warning */}
            {hasFingerprintMismatch && (
              <div className="flex items-start gap-2 p-2 mb-3 bg-amber-50 border border-amber-200 rounded-lg text-xs">
                <AlertCircleIcon className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-800">Timezone Mismatch Detected</p>
                  <p className="text-amber-700">
                    Fingerprint: <span className="font-mono">{currentFingerprint.timezone?.name}</span>
                    {' '}| Proxy: <span className="font-mono">{selectedProxy?.geoLocation?.timezone}</span>
                  </p>
                  <p className="text-amber-600 mt-1">
                    Click "Regenerate Fingerprint" to match the proxy location.
                  </p>
                </div>
              </div>
            )}

            <div className="text-xs bg-muted/50 p-3 rounded-lg space-y-1">
              <div className="flex">
                <span className="text-muted-foreground w-20">UA:</span>
                <span className="truncate flex-1" title={currentFingerprint.navigator?.userAgent}>
                  {currentFingerprint.navigator?.userAgent?.slice(0, 50)}...
                </span>
              </div>
              <div className="flex">
                <span className="text-muted-foreground w-20">Screen:</span>
                <span>
                  {currentFingerprint.screen?.width}x{currentFingerprint.screen?.height}
                </span>
              </div>
              <div className="flex">
                <span className="text-muted-foreground w-20">Timezone:</span>
                <span className={hasFingerprintMismatch ? 'text-amber-600 font-medium' : ''}>
                  {currentFingerprint.timezone?.name}
                </span>
              </div>
              <div className="flex">
                <span className="text-muted-foreground w-20">Language:</span>
                <span>{currentFingerprint.navigator?.language}</span>
              </div>
            </div>
          </div>

          {/* Proxy Configuration */}
          <div className="border-t pt-4">
            <label className="block text-sm font-medium mb-2">
              Proxy
            </label>
            <ProxySelector
              value={proxyId}
              onChange={handleProxyChange}
              disabled={isLoading}
            />

            {/* Proxy Geolocation Info */}
            {selectedProxy && (
              <div className="mt-3 p-3 bg-muted/50 rounded-lg">
                {isDetectingGeo ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2Icon className="w-4 h-4 animate-spin" />
                    <span>Detecting IP environment...</span>
                  </div>
                ) : selectedProxy.geoLocation ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{getCountryFlag(selectedProxy.geoLocation.country)}</span>
                      <div>
                        <div className="text-sm font-medium">
                          {selectedProxy.geoLocation.city}
                          {selectedProxy.geoLocation.region && `, ${selectedProxy.geoLocation.region}`}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {selectedProxy.geoLocation.countryName}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">Timezone: </span>
                        <span className="font-medium">{selectedProxy.geoLocation.timezone}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">IP: </span>
                        <span className="font-mono">{selectedProxy.geoLocation.ip}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                      <GlobeIcon className="w-3 h-3" />
                      <span>Fingerprint will auto-match this location on regenerate</span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDetectGeo()}
                      disabled={isDetectingGeo}
                      className="text-xs"
                    >
                      <MapPinIcon className="w-3 h-3 mr-1" />
                      Refresh Location
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-amber-600">
                      <AlertCircleIcon className="w-4 h-4" />
                      <span>IP environment not detected yet</span>
                    </div>
                    {geoError && (
                      <div className="text-xs text-red-500">{geoError}</div>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleDetectGeo()}
                      disabled={isDetectingGeo}
                    >
                      <MapPinIcon className="w-4 h-4 mr-1" />
                      Detect IP Environment
                    </Button>
                  </div>
                )}
              </div>
            )}
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
              className="w-full px-3 py-2 border rounded-md bg-background"
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground mt-1">
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
              placeholder="e.g., usa, main, test"
              className="w-full px-3 py-2 border rounded-md bg-background"
              disabled={isLoading}
            />
          </div>

          {/* Error */}
          {error && (
            <div className="text-sm text-red-500 p-2 bg-red-500/10 rounded">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
