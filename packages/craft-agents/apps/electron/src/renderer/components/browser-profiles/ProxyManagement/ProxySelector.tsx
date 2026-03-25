/**
 * Proxy Selector Component
 *
 * Dropdown component for selecting a proxy from the pool.
 * Used in profile creation/edit dialogs.
 */

import {
  CheckCircleIcon,
  ChevronDownIcon,
  CircleIcon,
  Loader2Icon,
  MapPinIcon,
  PlusIcon,
  XCircleIcon,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import type { ProxyStatus, SavedProxy } from '../../../../shared/types'

// Get country flag emoji from country code
function getCountryFlag(countryCode: string): string {
  const code = countryCode.toUpperCase()
  if (code.length !== 2) return '🌍'
  const codePoints = code
    .split('')
    .map((char) => 0x1f1e6 + char.charCodeAt(0) - 'A'.charCodeAt(0))
  return String.fromCodePoint(...codePoints)
}

import { CreateProxyDialog } from './CreateProxyDialog'

interface ProxySelectorProps {
  value: string | undefined
  onChange: (proxyId: string | undefined) => void
  disabled?: boolean
}

const STATUS_ICONS: Record<ProxyStatus, React.ReactNode> = {
  healthy: <CheckCircleIcon className="w-3 h-3 text-green-500" />,
  unhealthy: <XCircleIcon className="w-3 h-3 text-red-500" />,
  unknown: <CircleIcon className="w-3 h-3 text-gray-400" />,
  checking: <Loader2Icon className="w-3 h-3 text-yellow-500 animate-spin" />,
}

export function ProxySelector({
  value,
  onChange,
  disabled,
}: ProxySelectorProps) {
  const [proxies, setProxies] = useState<SavedProxy[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isOpen, setIsOpen] = useState(false)
  const [showCreateDialog, setShowCreateDialog] = useState(false)

  // Load proxies
  useEffect(() => {
    async function loadProxies() {
      try {
        const data = await window.electronAPI.listProxies()
        setProxies(data)
      } catch (err) {
        console.error('Failed to load proxies:', err)
      } finally {
        setIsLoading(false)
      }
    }
    loadProxies()
  }, [])

  // Find selected proxy
  const selectedProxy = value ? proxies.find((p) => p.id === value) : null

  // Handle proxy created
  const handleProxyCreated = (proxy: SavedProxy) => {
    setProxies((prev) => [proxy, ...prev])
    onChange(proxy.id)
    setShowCreateDialog(false)
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Element
      if (!target.closest('.proxy-selector')) {
        setIsOpen(false)
      }
    }

    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [isOpen])

  return (
    <div className="proxy-selector relative">
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between px-3 py-2 border rounded-md bg-background text-left ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-border'
        }`}
        disabled={disabled}
      >
        {isLoading ? (
          <span className="text-foreground/50">Loading...</span>
        ) : selectedProxy ? (
          <div className="flex items-center gap-2">
            {STATUS_ICONS[selectedProxy.status]}
            <span>{selectedProxy.name}</span>
            {selectedProxy.geoLocation && (
              <span className="text-sm">
                {getCountryFlag(selectedProxy.geoLocation.country)}
              </span>
            )}
            <span className="text-xs text-foreground/50">
              ({selectedProxy.host}:{selectedProxy.port})
            </span>
          </div>
        ) : (
          <span className="text-foreground/50">No proxy selected</span>
        )}
        <ChevronDownIcon className="w-4 h-4 text-foreground/50" />
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg max-h-60 overflow-y-auto">
          {/* No proxy option */}
          <button
            type="button"
            onClick={() => {
              onChange(undefined)
              setIsOpen(false)
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-foreground/5"
          >
            <CircleIcon className="w-3 h-3 text-gray-400" />
            <span className="text-foreground/50">No proxy</span>
          </button>

          {/* Divider */}
          {proxies.length > 0 && <div className="border-t my-1" />}

          {/* Proxy list */}
          {proxies.map((proxy) => (
            <button
              key={proxy.id}
              type="button"
              onClick={() => {
                onChange(proxy.id)
                setIsOpen(false)
              }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-foreground/5 ${
                value === proxy.id ? 'bg-foreground/5' : ''
              }`}
            >
              {STATUS_ICONS[proxy.status]}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate">{proxy.name}</span>
                  <span className="text-xs uppercase text-foreground/50">
                    {proxy.type}
                  </span>
                  {/* Geo indicator */}
                  {proxy.geoLocation ? (
                    <span
                      className="text-sm"
                      title={`${proxy.geoLocation.city}, ${proxy.geoLocation.countryName}`}
                    >
                      {getCountryFlag(proxy.geoLocation.country)}
                    </span>
                  ) : (
                    <span title="Geo not detected">
                      <MapPinIcon className="w-3 h-3 text-foreground/50" />
                    </span>
                  )}
                </div>
                <div className="text-xs text-foreground/50">
                  {proxy.host}:{proxy.port}
                  {proxy.geoLocation
                    ? ` • ${proxy.geoLocation.city}, ${proxy.geoLocation.country}`
                    : proxy.region && ` (${proxy.region.toUpperCase()})`}
                </div>
              </div>
              {proxy.responseTimeMs !== undefined && (
                <span className="text-xs text-foreground/50">
                  {proxy.responseTimeMs}ms
                </span>
              )}
            </button>
          ))}

          {/* Divider */}
          <div className="border-t my-1" />

          {/* Create new proxy */}
          <button
            type="button"
            onClick={() => {
              setIsOpen(false)
              setShowCreateDialog(true)
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-foreground/5 text-accent"
          >
            <PlusIcon className="w-4 h-4" />
            <span>Add new proxy...</span>
          </button>
        </div>
      )}

      {/* Create proxy dialog */}
      {showCreateDialog && (
        <CreateProxyDialog
          onClose={() => setShowCreateDialog(false)}
          onCreated={handleProxyCreated}
        />
      )}
    </div>
  )
}
