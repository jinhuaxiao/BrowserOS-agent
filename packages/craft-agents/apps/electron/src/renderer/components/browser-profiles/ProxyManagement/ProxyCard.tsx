/**
 * Proxy Card Component
 *
 * Displays a single proxy with health status indicator and actions.
 */

import {
  CheckCircleIcon,
  CircleIcon,
  GlobeIcon,
  Loader2Icon,
  MapPinIcon,
  RefreshCwIcon,
  Trash2Icon,
  UsersIcon,
  XCircleIcon,
} from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import type { ProxyStatus, SavedProxy } from '../../../../shared/types'

interface ProxyCardProps {
  proxy: SavedProxy
  isSelected?: boolean
  onSelect?: (proxyId: string) => void
  onDeleted: (proxyId: string) => void
  onUpdated: (proxy: SavedProxy) => void
}

const STATUS_CONFIG: Record<
  ProxyStatus,
  { icon: React.ReactNode; color: string; label: string }
> = {
  healthy: {
    icon: <CheckCircleIcon className="w-4 h-4" />,
    color: 'text-green-500',
    label: 'Healthy',
  },
  unhealthy: {
    icon: <XCircleIcon className="w-4 h-4" />,
    color: 'text-red-500',
    label: 'Unhealthy',
  },
  unknown: {
    icon: <CircleIcon className="w-4 h-4" />,
    color: 'text-gray-400',
    label: 'Unknown',
  },
  checking: {
    icon: <Loader2Icon className="w-4 h-4 animate-spin" />,
    color: 'text-yellow-500',
    label: 'Checking...',
  },
}

// Get country flag emoji from country code
function getCountryFlag(countryCode: string): string {
  const code = countryCode.toUpperCase()
  if (code.length !== 2) return '🌍'
  const codePoints = code
    .split('')
    .map((char) => 0x1f1e6 + char.charCodeAt(0) - 'A'.charCodeAt(0))
  return String.fromCodePoint(...codePoints)
}

export function ProxyCard({
  proxy,
  isSelected,
  onSelect,
  onDeleted,
  onUpdated,
}: ProxyCardProps) {
  const [isChecking, setIsChecking] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isDetectingGeo, setIsDetectingGeo] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const statusConfig = STATUS_CONFIG[proxy.status]

  // Check health
  const handleCheckHealth = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsChecking(true)
    try {
      const result = await window.electronAPI.checkProxyHealth(proxy.id)
      // Fetch updated proxy
      const updated = await window.electronAPI.getProxy(proxy.id)
      if (updated) {
        onUpdated(updated)
      }
    } catch (err) {
      console.error('Failed to check proxy health:', err)
    } finally {
      setIsChecking(false)
    }
  }

  // Detect geolocation
  const handleDetectGeo = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsDetectingGeo(true)
    try {
      await window.electronAPI.detectProxyGeoLocation(proxy.id)
      // Fetch updated proxy
      const updated = await window.electronAPI.getProxy(proxy.id)
      if (updated) {
        onUpdated(updated)
      }
    } catch (err) {
      console.error('Failed to detect proxy geolocation:', err)
    } finally {
      setIsDetectingGeo(false)
    }
  }

  // Delete proxy
  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation()

    if (!showDeleteConfirm) {
      // Check if proxy is in use
      const profileIds = await window.electronAPI.getProfilesUsingProxy(
        proxy.id,
      )
      if (profileIds.length > 0) {
        setShowDeleteConfirm(true)
        return
      }
    }

    setIsDeleting(true)
    try {
      await window.electronAPI.deleteProxy(proxy.id)
      onDeleted(proxy.id)
    } catch (err) {
      console.error('Failed to delete proxy:', err)
    } finally {
      setIsDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  const handleClick = () => {
    if (onSelect) {
      onSelect(proxy.id)
    }
  }

  return (
    <div
      className={`border border-border rounded-xl p-5 transition-all duration-200 shadow-minimal ${
        isSelected
          ? 'border-accent bg-accent/5'
          : 'bg-card hover:border-accent hover:-translate-y-0.5 cursor-pointer'
      }`}
      onClick={handleClick}
    >
      <div className="flex items-start justify-between">
        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {/* Status indicator */}
            <span className={statusConfig.color}>{statusConfig.icon}</span>

            {/* Name */}
            <span className="font-bold text-lg text-foreground truncate">
              {proxy.name}
            </span>

            {/* Type badge */}
            <span className="px-2 py-0.5 text-xs font-mono font-medium rounded-full border border-border bg-foreground/5 uppercase text-foreground/50">
              {proxy.type}
            </span>
          </div>

          {/* Address */}
          <p className="text-sm text-foreground/60 font-mono mt-1">
            {proxy.host}:{proxy.port}
            {proxy.username && ' (authenticated)'}
          </p>

          {/* Geolocation info */}
          {proxy.geoLocation && (
            <div className="flex items-center gap-2 mt-3 text-sm text-foreground/60">
              <span className="text-lg">
                {getCountryFlag(proxy.geoLocation.country)}
              </span>
              <span className="font-medium">
                {proxy.geoLocation.city}
                {proxy.geoLocation.region && `, ${proxy.geoLocation.region}`}
              </span>
              <span className="text-foreground/50 text-xs font-mono">
                ({proxy.geoLocation.timezone})
              </span>
            </div>
          )}

          {/* Details row */}
          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border text-xs text-foreground/50">
            {/* Profile count */}
            <span className="flex items-center gap-1 font-medium">
              <UsersIcon className="w-3 h-3" />
              {proxy.profileCount}{' '}
              {proxy.profileCount === 1 ? 'profile' : 'profiles'}
            </span>

            {/* Region (only show if no geoLocation) */}
            {!proxy.geoLocation && proxy.region && (
              <span className="uppercase font-mono">{proxy.region}</span>
            )}

            {/* Response time */}
            {proxy.responseTimeMs !== undefined && (
              <span className="font-mono">{proxy.responseTimeMs}ms</span>
            )}

            {/* Last checked */}
            {proxy.lastCheckedAt && (
              <span>
                Checked {new Date(proxy.lastCheckedAt).toLocaleTimeString()}
              </span>
            )}

            {/* IP address if geoLocation available */}
            {proxy.geoLocation?.ip && (
              <span className="font-mono">{proxy.geoLocation.ip}</span>
            )}
          </div>

          {/* Tags */}
          {proxy.tags && proxy.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-3">
              {proxy.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 text-xs rounded-full border border-border bg-foreground/5 text-foreground/50"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Error message */}
          {proxy.errorMessage && (
            <p className="text-xs text-red-500 mt-2">{proxy.errorMessage}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 ml-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDetectGeo}
            disabled={isDetectingGeo}
            title={
              proxy.geoLocation ? 'Refresh geolocation' : 'Detect geolocation'
            }
            className="text-foreground/50 hover:bg-foreground/5 hover:text-foreground"
          >
            {isDetectingGeo ? (
              <Loader2Icon className="w-4 h-4 animate-spin" />
            ) : (
              <MapPinIcon className="w-4 h-4" />
            )}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleCheckHealth}
            disabled={isChecking}
            title="Check health"
            className="text-foreground/50 hover:bg-foreground/5 hover:text-foreground"
          >
            {isChecking ? (
              <Loader2Icon className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCwIcon className="w-4 h-4" />
            )}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            disabled={isDeleting}
            className={
              showDeleteConfirm
                ? 'text-destructive hover:bg-destructive/10'
                : 'text-foreground/50 hover:bg-destructive/10 hover:text-destructive'
            }
            title={
              showDeleteConfirm
                ? 'Click again to confirm delete'
                : 'Delete proxy'
            }
          >
            {isDeleting ? (
              <Loader2Icon className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2Icon className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <div className="mt-3 p-2 bg-red-500/10 rounded text-sm">
          <p className="text-red-500">
            This proxy is used by {proxy.profileCount} profile(s). Click delete
            again to confirm.
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              setShowDeleteConfirm(false)
            }}
            className="mt-1"
          >
            Cancel
          </Button>
        </div>
      )}
    </div>
  )
}
