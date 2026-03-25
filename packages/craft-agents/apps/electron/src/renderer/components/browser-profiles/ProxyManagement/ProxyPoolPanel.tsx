/**
 * Proxy Pool Panel Component
 *
 * Main panel for managing the proxy pool.
 * Displays list of proxies with health status and actions.
 */

import { ImportIcon, Loader2Icon, PlusIcon, RefreshCwIcon } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import type { ProxyHealthResult, SavedProxy } from '../../../../shared/types'
import { CreateProxyDialog } from './CreateProxyDialog'
import { ProxyCard } from './ProxyCard'
import { ProxyImportDialog } from './ProxyImportDialog'

interface ProxyPoolPanelProps {
  onProxySelect?: (proxyId: string) => void
  selectedProxyId?: string
}

export function ProxyPoolPanel({
  onProxySelect,
  selectedProxyId,
}: ProxyPoolPanelProps) {
  const [proxies, setProxies] = useState<SavedProxy[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCheckingAll, setIsCheckingAll] = useState(false)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load proxies
  const loadProxies = useCallback(async () => {
    try {
      const data = await window.electronAPI.listProxies()
      setProxies(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load proxies')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadProxies()
  }, [loadProxies])

  // Check all proxies health
  const handleCheckAllHealth = async () => {
    setIsCheckingAll(true)
    try {
      await window.electronAPI.checkAllProxiesHealth()
      await loadProxies()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to check proxy health',
      )
    } finally {
      setIsCheckingAll(false)
    }
  }

  // Handle proxy created
  const handleProxyCreated = (proxy: SavedProxy) => {
    setProxies((prev) => [proxy, ...prev])
    setShowCreateDialog(false)
  }

  // Handle proxies imported
  const handleProxiesImported = (newProxies: SavedProxy[]) => {
    setProxies((prev) => [...newProxies, ...prev])
    setShowImportDialog(false)
  }

  // Handle proxy deleted
  const handleProxyDeleted = (proxyId: string) => {
    setProxies((prev) => prev.filter((p) => p.id !== proxyId))
  }

  // Handle proxy updated (after health check)
  const handleProxyUpdated = (updatedProxy: SavedProxy) => {
    setProxies((prev) =>
      prev.map((p) => (p.id === updatedProxy.id ? updatedProxy : p)),
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2Icon className="w-6 h-6 animate-spin text-foreground/50" />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div>
          <h2 className="text-lg font-bold text-foreground">
            Proxy Pool
          </h2>
          <p className="text-sm text-foreground/50">
            {proxies.length} {proxies.length === 1 ? 'proxy' : 'proxies'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCheckAllHealth}
            disabled={isCheckingAll || proxies.length === 0}
            className="border-border text-foreground hover:bg-foreground/5"
          >
            {isCheckingAll ? (
              <Loader2Icon className="w-4 h-4 animate-spin mr-1" />
            ) : (
              <RefreshCwIcon className="w-4 h-4 mr-1" />
            )}
            Check All
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowImportDialog(true)}
            className="border-border text-foreground hover:bg-foreground/5"
          >
            <ImportIcon className="w-4 h-4 mr-1" />
            Import
          </Button>
          <Button
            size="sm"
            onClick={() => setShowCreateDialog(true)}
            className="bg-foreground text-background hover:bg-foreground/90"
          >
            <PlusIcon className="w-4 h-4 mr-1" />
            Add Proxy
          </Button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 mt-4 text-sm text-red-500 p-2 bg-red-500/10 rounded">
          {error}
        </div>
      )}

      {/* Proxy List */}
      <div className="flex-1 overflow-y-auto p-4">
        {proxies.length === 0 ? (
          <div className="text-center py-8 text-foreground/50">
            <p>No proxies in the pool</p>
            <p className="text-sm mt-1">
              Add proxies to share them across multiple profiles
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {proxies.map((proxy) => (
              <ProxyCard
                key={proxy.id}
                proxy={proxy}
                isSelected={selectedProxyId === proxy.id}
                onSelect={onProxySelect}
                onDeleted={handleProxyDeleted}
                onUpdated={handleProxyUpdated}
              />
            ))}
          </div>
        )}
      </div>

      {/* Dialogs */}
      {showCreateDialog && (
        <CreateProxyDialog
          onClose={() => setShowCreateDialog(false)}
          onCreated={handleProxyCreated}
        />
      )}

      {showImportDialog && (
        <ProxyImportDialog
          onClose={() => setShowImportDialog(false)}
          onImported={handleProxiesImported}
        />
      )}
    </div>
  )
}
