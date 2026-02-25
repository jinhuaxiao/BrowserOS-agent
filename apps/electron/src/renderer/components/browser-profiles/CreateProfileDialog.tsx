/**
 * Create Profile Dialog Component
 *
 * Dialog for creating a new browser profile.
 * Supports proxy pool selection, groups, templates, and startup URL.
 */

import { useState, useEffect } from 'react';
import type {
  BrowserProfileConfig,
  CreateProfileInput,
  EcommercePlatform,
  ProfileGroup,
  ProfileTemplate,
  SavedProxy,
  GeoLocation,
} from '../../../shared/types';
import { Button } from '@/components/ui/button';
import { XIcon, LayoutTemplateIcon, MapPinIcon, Loader2Icon, GlobeIcon, AlertCircleIcon } from 'lucide-react';
import { ProxySelector } from './ProxyManagement/ProxySelector';

// Get country flag emoji from country code
function getCountryFlag(countryCode: string): string {
  const code = countryCode.toUpperCase();
  if (code.length !== 2) return '🌍';
  const codePoints = code
    .split('')
    .map((char) => 0x1f1e6 + char.charCodeAt(0) - 'A'.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

interface CreateProfileDialogProps {
  onClose: () => void;
  onCreated: (profile: BrowserProfileConfig) => void;
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

const REGIONS = [
  { value: 'us', label: 'United States' },
  { value: 'eu', label: 'Europe' },
  { value: 'asia', label: 'Asia' },
  { value: 'oceania', label: 'Oceania' },
];

const OS_PLATFORMS = [
  { value: 'windows', label: 'Windows' },
  { value: 'macos', label: 'macOS' },
  { value: 'linux', label: 'Linux' },
];

export function CreateProfileDialog({ onClose, onCreated }: CreateProfileDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [groups, setGroups] = useState<ProfileGroup[]>([]);
  const [templates, setTemplates] = useState<ProfileTemplate[]>([]);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [platform, setPlatform] = useState<EcommercePlatform>('other');
  const [targetPlatform, setTargetPlatform] = useState<'windows' | 'macos' | 'linux'>('windows');
  const [targetRegion, setTargetRegion] = useState<'us' | 'eu' | 'asia' | 'oceania'>('us');
  const [tags, setTags] = useState('');

  // New fields
  const [proxyId, setProxyId] = useState<string | undefined>(undefined);
  const [groupId, setGroupId] = useState<string>('');
  const [startupUrl, setStartupUrl] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');

  // Proxy geo detection state
  const [selectedProxy, setSelectedProxy] = useState<SavedProxy | null>(null);
  const [isDetectingGeo, setIsDetectingGeo] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  // Load groups and templates
  useEffect(() => {
    async function loadData() {
      try {
        const [groupList, templateList] = await Promise.all([
          window.electronAPI.listProfileGroups(),
          window.electronAPI.listProfileTemplates(),
        ]);
        setGroups(groupList);
        setTemplates(templateList);
      } catch (err) {
        console.error('Failed to load groups/templates:', err);
      }
    }
    loadData();
  }, []);

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
        // Auto-detect geo when proxy is selected
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

  // Apply template
  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplateId(templateId);

    if (!templateId) return;

    const template = templates.find((t) => t.id === templateId);
    if (!template) return;

    // Apply template values
    if (template.platform) setPlatform(template.platform);
    if (template.targetPlatform) setTargetPlatform(template.targetPlatform);
    if (template.targetRegion) setTargetRegion(template.targetRegion);
    if (template.proxyId) {
      handleProxyChange(template.proxyId);
    }
    if (template.groupId) setGroupId(template.groupId);
    if (template.startupUrl) setStartupUrl(template.startupUrl);
    if (template.tags) setTags(template.tags.join(', '));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError('Profile name is required');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const input: CreateProfileInput = {
        name: name.trim(),
        description: description.trim() || undefined,
        platform,
        targetPlatform,
        targetRegion,
        proxyId,
        groupId: groupId || undefined,
        startupUrl: startupUrl.trim() || undefined,
        tags: tags.trim()
          ? tags.split(',').map((t) => t.trim()).filter(Boolean)
          : undefined,
      };

      const profile = await window.electronAPI.createBrowserProfile(input);
      onCreated(profile);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create profile');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Create Browser Profile</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <XIcon className="w-4 h-4" />
          </Button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Template selector */}
          {templates.length > 0 && (
            <div className="p-3 bg-muted/50 rounded-lg">
              <label className="flex items-center gap-2 text-sm font-medium mb-2">
                <LayoutTemplateIcon className="w-4 h-4" />
                Start from Template
              </label>
              <select
                value={selectedTemplateId}
                onChange={(e) => handleTemplateChange(e.target.value)}
                className="w-full px-3 py-2 border rounded-md bg-background"
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

          {/* Fingerprint Options */}
          <div className="border-t pt-4">
            <h3 className="text-sm font-medium mb-3">Fingerprint Options</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-muted-foreground mb-1">
                  Operating System
                </label>
                <select
                  value={targetPlatform}
                  onChange={(e) =>
                    setTargetPlatform(e.target.value as 'windows' | 'macos' | 'linux')
                  }
                  className="w-full px-3 py-2 border rounded-md bg-background"
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
                <label className="block text-sm text-muted-foreground mb-1">
                  Region
                  {selectedProxy?.geoLocation && (
                    <span className="text-xs text-green-600 ml-1">(auto from proxy)</span>
                  )}
                </label>
                <select
                  value={targetRegion}
                  onChange={(e) =>
                    setTargetRegion(e.target.value as 'us' | 'eu' | 'asia' | 'oceania')
                  }
                  className={`w-full px-3 py-2 border rounded-md bg-background ${
                    selectedProxy?.geoLocation ? 'opacity-50' : ''
                  }`}
                  disabled={isLoading || !!selectedProxy?.geoLocation}
                  title={selectedProxy?.geoLocation ? 'Region will be auto-detected from proxy IP' : ''}
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
                      <span>Fingerprint will auto-match this location (timezone, language)</span>
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
                    <p className="text-xs text-muted-foreground">
                      Detecting will set the fingerprint timezone/language to match the proxy's location
                    </p>
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
              {isLoading ? 'Creating...' : 'Create Profile'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
