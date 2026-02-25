/**
 * Browser Profile Card Component
 *
 * Displays a single browser profile with its status and actions.
 * Redesigned to match Amazon Seller Central style.
 */

import { useState } from 'react';
import type { BrowserProfileConfig, LaunchResult } from '../../../shared/types';
import { Button } from '@/components/ui/button';
import {
  PlayIcon,
  StopCircleIcon,
  Trash2Icon,
  RefreshCwIcon,
  GlobeIcon,
  SettingsIcon,
} from 'lucide-react';

interface BrowserProfileCardProps {
  profile: BrowserProfileConfig;
  isRunning: boolean;
  onLaunch: (profileId: string) => Promise<LaunchResult>;
  onStop: (profileId: string) => Promise<boolean>;
  onDelete: (profileId: string) => Promise<boolean>;
  onRefresh: () => void;
  onEdit: (profile: BrowserProfileConfig) => void;
}

export function BrowserProfileCard({
  profile,
  isRunning,
  onLaunch,
  onStop,
  onDelete,
  onRefresh,
  onEdit,
}: BrowserProfileCardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLaunch = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await onLaunch(profile.id);
      if (!result.success) {
        setError(result.error || 'Failed to launch browser');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStop = async () => {
    setIsLoading(true);
    try {
      await onStop(profile.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop browser');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete "${profile.name}"?`)) {
      return;
    }
    setIsLoading(true);
    try {
      await onDelete(profile.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete profile');
      setIsLoading(false);
    }
  };

  const handleRegenerateFingerprint = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await window.electronAPI.regenerateBrowserFingerprint(profile.id);
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to regenerate fingerprint');
    } finally {
      setIsLoading(false);
    }
  };

  const getPlatformLabel = (platform?: string) => {
    const labels: Record<string, string> = {
      amazon: 'Amazon',
      ebay: 'eBay',
      shopee: 'Shopee',
      lazada: 'Lazada',
      aliexpress: 'AliExpress',
      wish: 'Wish',
      etsy: 'Etsy',
      walmart: 'Walmart',
      mercadolibre: 'MercadoLibre',
      other: 'Other',
    };
    return labels[platform || ''] || platform || 'General';
  };

  return (
    <div
      className={`
        flex flex-col h-full
        rounded border p-4 bg-white
        ${isRunning ? 'border-green-500 shadow-md' : 'border-[#D5D9D9] shadow-sm hover:shadow-md'}
        ${isLoading ? 'opacity-75' : ''}
        transition-shadow duration-200
      `}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          {/* <GlobeIcon className="w-5 h-5 text-muted-foreground" /> */}
          <div>
            <h3 className="font-bold text-lg text-[#007185] hover:underline cursor-pointer leading-tight">
              {profile.name}
            </h3>
            <p className="text-xs text-[#565959] font-medium mt-0.5">
              {getPlatformLabel(profile.platform)}
            </p>
          </div>
        </div>
        <div
          className={`
            px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide border
            ${isRunning 
              ? 'bg-green-50 text-green-700 border-green-200' 
              : 'bg-gray-50 text-gray-500 border-gray-200'}
          `}
        >
          {isRunning ? 'Running' : 'Idle'}
        </div>
      </div>

      {/* Description */}
      {profile.description && (
        <p className="text-sm text-[#0F1111] mb-3 line-clamp-2">
          {profile.description}
        </p>
      )}

      {/* Fingerprint Info - Data Table Style */}
      {profile.fingerprint && (
        <div className="text-xs mb-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          <span className="font-bold text-[#565959]">UA:</span>
          <span className="truncate text-[#0F1111]" title={profile.fingerprint.navigator?.userAgent}>
            {profile.fingerprint.navigator?.userAgent?.slice(0, 40) || 'N/A'}...
          </span>
          
          <span className="font-bold text-[#565959]">Screen:</span>
          <span className="text-[#0F1111]">
            {profile.fingerprint.screen?.width || 0}x{profile.fingerprint.screen?.height || 0}
          </span>
          
          <span className="font-bold text-[#565959]">Timezone:</span>
          <span className="text-[#0F1111]">{profile.fingerprint.timezone?.name || 'N/A'}</span>
        </div>
      )}

      {/* Proxy Info */}
      {profile.proxy && (
        <div className="text-xs mb-3 flex items-center gap-2">
          <span className="font-bold text-[#565959]">Proxy:</span>
          <span className="text-[#0F1111] bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">
            {profile.proxy.type}://{profile.proxy.host}:{profile.proxy.port}
          </span>
        </div>
      )}

      {/* Tags */}
      {profile.tags && profile.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-4">
          {profile.tags.map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 bg-gray-100 text-[#565959] border border-gray-200 text-xs rounded-sm"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="text-xs text-[#B12704] mb-3 p-2 bg-red-50 border border-red-100 rounded-sm flex items-center gap-2">
          <span className="font-bold">!</span> {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 mt-auto pt-2 border-t border-gray-100 flex-wrap">
        {isRunning ? (
          <Button
            size="sm"
            className="bg-white hover:bg-gray-50 text-black border border-[#D5D9D9] shadow-sm h-8 px-3"
            onClick={handleStop}
            disabled={isLoading}
          >
            <StopCircleIcon className="w-4 h-4 mr-1 text-[#B12704]" />
            Stop
          </Button>
        ) : (
          <Button
            size="sm"
            className="bg-[#FF9900] hover:bg-[#FA8900] text-black border border-[#A88734] shadow-sm h-8 px-3 font-medium"
            onClick={handleLaunch}
            disabled={isLoading}
          >
            <PlayIcon className="w-4 h-4 mr-1" />
            Launch
          </Button>
        )}

        <div className="flex items-center gap-1 ml-auto">
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 text-[#565959] hover:text-[#0F1111] hover:bg-gray-100"
            onClick={handleRegenerateFingerprint}
            disabled={isLoading || isRunning}
            title="Regenerate fingerprint"
          >
            <RefreshCwIcon className="w-4 h-4" />
          </Button>

          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 text-[#565959] hover:text-[#0F1111] hover:bg-gray-100"
            onClick={() => onEdit(profile)}
            disabled={isLoading}
            title="Edit profile settings"
          >
            <SettingsIcon className="w-4 h-4" />
          </Button>

          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 text-[#565959] hover:text-[#B12704] hover:bg-red-50"
            onClick={handleDelete}
            disabled={isLoading || isRunning}
            title="Delete profile"
          >
            <Trash2Icon className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Last Launched */}
      {profile.lastLaunchedAt && (
        <div className="mt-2 text-[10px] text-[#565959] text-right">
          Last used: {new Date(profile.lastLaunchedAt).toLocaleDateString()}
        </div>
      )}
    </div>
  );
}
