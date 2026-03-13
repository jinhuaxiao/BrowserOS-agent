/**
 * Browser Profile Card Component
 *
 * Displays a single browser profile with its status and actions.
 * Redesigned to match Amazon Seller Central style.
 */

import {
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CopyIcon,
  LinkIcon,
  PlayIcon,
  RefreshCwIcon,
  SettingsIcon,
  StopCircleIcon,
  Trash2Icon,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import type { BrowserProfileConfig, LaunchResult } from '../../../shared/types'

interface BrowserProfileCardProps {
  profile: BrowserProfileConfig
  isRunning: boolean
  onLaunch: (profileId: string) => Promise<LaunchResult>
  onStop: (profileId: string) => Promise<boolean>
  onDelete: (profileId: string) => Promise<boolean>
  onRefresh: () => void
  onEdit: (profile: BrowserProfileConfig) => void
}

interface McpToolInfo {
  name: string
  description?: string
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
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mcpPort, setMcpPort] = useState<number | null>(null)
  const [mcpConnected, setMcpConnected] = useState(false)
  const [mcpTools, setMcpTools] = useState<McpToolInfo[]>([])
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [showTools, setShowTools] = useState(false)

  const mcpUrl = mcpPort ? `http://127.0.0.1:${mcpPort}/mcp` : null
  const claudeCommand = mcpUrl
    ? `claude mcp add browseros-${profile.name.toLowerCase().replace(/\s+/g, '-')} --transport sse ${mcpUrl}`
    : null

  useEffect(() => {
    if (!isRunning) {
      setMcpPort(null)
      setMcpConnected(false)
      setMcpTools([])
      setShowTools(false)
      return
    }

    window.electronAPI.getBrowserProfileMcpPort(profile.id).then((port) => {
      setMcpPort(port)
    })
  }, [isRunning, profile.id])

  useEffect(() => {
    if (!mcpUrl || !isRunning) return

    let cancelled = false

    const checkHealth = async () => {
      try {
        const healthUrl = mcpUrl.replace('/mcp', '/health')
        const res = await fetch(healthUrl, {
          signal: AbortSignal.timeout(3000),
        })
        if (!cancelled && res.ok) {
          setMcpConnected(true)
          const data = await res.json()
          if (data.tools_count != null) {
            setMcpTools((prev) => (prev.length > 0 ? prev : []))
          }
        }
      } catch {
        if (!cancelled) setMcpConnected(false)
      }
    }

    checkHealth()
    const interval = setInterval(checkHealth, 10000)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [mcpUrl, isRunning])

  useEffect(() => {
    if (!mcpConnected || !mcpPort || mcpTools.length > 0) return

    const fetchTools = async () => {
      try {
        const res = await fetch(`http://127.0.0.1:${mcpPort}/api/tools`, {
          signal: AbortSignal.timeout(5000),
        })
        if (res.ok) {
          const data = await res.json()
          if (Array.isArray(data.tools)) {
            setMcpTools(
              data.tools.map((t: { name: string; description: string }) => ({
                name: t.name,
                description: t.description,
              })),
            )
          }
        }
      } catch {
        // Tools endpoint may not be available
      }
    }

    fetchTools()
  }, [mcpConnected, mcpPort, mcpTools.length])

  const copyToClipboard = useCallback(async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(field)
      setTimeout(() => setCopiedField(null), 2000)
    } catch {
      // Clipboard API may fail
    }
  }, [])

  const handleLaunch = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await onLaunch(profile.id)
      if (!result.success) {
        setError(result.error || 'Failed to launch browser')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsLoading(false)
    }
  }

  const handleStop = async () => {
    setIsLoading(true)
    try {
      await onStop(profile.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop browser')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete "${profile.name}"?`)) {
      return
    }
    setIsLoading(true)
    try {
      await onDelete(profile.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete profile')
      setIsLoading(false)
    }
  }

  const handleRegenerateFingerprint = async () => {
    setIsLoading(true)
    setError(null)
    try {
      await window.electronAPI.regenerateBrowserFingerprint(profile.id)
      onRefresh()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to regenerate fingerprint',
      )
    } finally {
      setIsLoading(false)
    }
  }

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
    }
    return labels[platform || ''] || platform || 'General'
  }

  return (
    <div
      className={`flex h-full flex-col rounded border bg-white p-4 ${isRunning ? 'border-green-500 shadow-md' : 'border-[#D5D9D9] shadow-sm hover:shadow-md'}
        ${isLoading ? 'opacity-75' : ''}transition-shadow duration-200`}
    >
      {/* Header */}
      <div className="mb-3 flex items-start justify-between">
        <div className="flex items-center gap-2">
          {/* <GlobeIcon className="w-5 h-5 text-muted-foreground" /> */}
          <div>
            <h3 className="cursor-pointer font-bold text-[#007185] text-lg leading-tight hover:underline">
              {profile.name}
            </h3>
            <p className="mt-0.5 font-medium text-[#565959] text-xs">
              {getPlatformLabel(profile.platform)}
            </p>
          </div>
        </div>
        <div
          className={`border px-2 py-0.5 font-bold text-[10px] uppercase tracking-wide ${
            isRunning
              ? 'border-green-200 bg-green-50 text-green-700'
              : 'border-gray-200 bg-gray-50 text-gray-500'
          }
          `}
        >
          {isRunning ? 'Running' : 'Idle'}
        </div>
      </div>

      {/* Description */}
      {profile.description && (
        <p className="mb-3 line-clamp-2 text-[#0F1111] text-sm">
          {profile.description}
        </p>
      )}

      {/* Fingerprint Info - Data Table Style */}
      {profile.fingerprint && (
        <div className="mb-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
          <span className="font-bold text-[#565959]">UA:</span>
          <span
            className="truncate text-[#0F1111]"
            title={profile.fingerprint.navigator?.userAgent}
          >
            {profile.fingerprint.navigator?.userAgent?.slice(0, 40) || 'N/A'}...
          </span>

          <span className="font-bold text-[#565959]">Screen:</span>
          <span className="text-[#0F1111]">
            {profile.fingerprint.screen?.width || 0}x
            {profile.fingerprint.screen?.height || 0}
          </span>

          <span className="font-bold text-[#565959]">Timezone:</span>
          <span className="text-[#0F1111]">
            {profile.fingerprint.timezone?.name || 'N/A'}
          </span>
        </div>
      )}

      {/* Proxy Info */}
      {profile.proxy && (
        <div className="mb-3 flex items-center gap-2 text-xs">
          <span className="font-bold text-[#565959]">Proxy:</span>
          <span className="rounded border border-gray-200 bg-gray-100 px-1.5 py-0.5 text-[#0F1111]">
            {profile.proxy.type}://{profile.proxy.host}:{profile.proxy.port}
          </span>
        </div>
      )}

      {/* Tags */}
      {profile.tags && profile.tags.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1">
          {profile.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-sm border border-gray-200 bg-gray-100 px-2 py-0.5 text-[#565959] text-xs"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* MCP Server Info Panel */}
      {isRunning && mcpUrl && (
        <div className="mb-3 rounded-sm border border-blue-200 bg-blue-50 p-3 text-xs">
          <div className="mb-2 flex items-center gap-1.5">
            <LinkIcon className="h-3.5 w-3.5 text-blue-600" />
            <span className="font-bold text-blue-800">MCP Server</span>
            <span
              className={`ml-auto inline-flex items-center gap-1 ${mcpConnected ? 'text-green-600' : 'text-yellow-600'}`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${mcpConnected ? 'bg-green-500' : 'bg-yellow-500'}`}
              />
              {mcpConnected ? 'Connected' : 'Connecting...'}
              {mcpConnected && mcpTools.length > 0 && (
                <span className="ml-1 text-blue-600">
                  | {mcpTools.length} tools
                </span>
              )}
            </span>
          </div>

          {/* Server URL */}
          <div className="mb-1.5 flex items-center gap-1.5">
            <span className="shrink-0 font-bold text-[#565959]">URL:</span>
            <code className="flex-1 select-all truncate rounded border border-blue-100 bg-white px-1.5 py-0.5 text-[#0F1111]">
              {mcpUrl}
            </code>
            <button
              type="button"
              onClick={() => copyToClipboard(mcpUrl, 'url')}
              className="shrink-0 rounded p-0.5 transition-colors hover:bg-blue-100"
              title="Copy URL"
            >
              {copiedField === 'url' ? (
                <CheckIcon className="h-3.5 w-3.5 text-green-600" />
              ) : (
                <CopyIcon className="h-3.5 w-3.5 text-blue-600" />
              )}
            </button>
          </div>

          {/* Claude Code command */}
          {claudeCommand && (
            <div className="flex items-center gap-1.5">
              <span className="shrink-0 font-bold text-[#565959]">CLI:</span>
              <code className="flex-1 select-all truncate rounded border border-blue-100 bg-white px-1.5 py-0.5 text-[#0F1111] text-[10px]">
                {claudeCommand}
              </code>
              <button
                type="button"
                onClick={() => copyToClipboard(claudeCommand, 'cli')}
                className="shrink-0 rounded p-0.5 transition-colors hover:bg-blue-100"
                title="Copy Claude Code command"
              >
                {copiedField === 'cli' ? (
                  <CheckIcon className="h-3.5 w-3.5 text-green-600" />
                ) : (
                  <CopyIcon className="h-3.5 w-3.5 text-blue-600" />
                )}
              </button>
            </div>
          )}

          {/* Tools list (collapsible) */}
          {mcpTools.length > 0 && (
            <div className="mt-2 border-blue-200 border-t pt-2">
              <button
                type="button"
                onClick={() => setShowTools(!showTools)}
                className="flex items-center gap-1 font-medium text-blue-700 hover:text-blue-900"
              >
                {showTools ? (
                  <ChevronDownIcon className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRightIcon className="h-3.5 w-3.5" />
                )}
                Available Tools ({mcpTools.length})
              </button>
              {showTools && (
                <div className="mt-1.5 max-h-32 space-y-0.5 overflow-y-auto">
                  {mcpTools.map((tool) => (
                    <div
                      key={tool.name}
                      className="flex items-start gap-1.5 py-0.5"
                      title={tool.description}
                    >
                      <span className="mt-0.5 text-blue-400">-</span>
                      <span className="font-mono text-[#0F1111]">
                        {tool.name}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-3 flex items-center gap-2 rounded-sm border border-red-100 bg-red-50 p-2 text-[#B12704] text-xs">
          <span className="font-bold">!</span> {error}
        </div>
      )}

      {/* Actions */}
      <div className="mt-auto flex flex-wrap items-center gap-2 border-gray-100 border-t pt-2">
        {isRunning ? (
          <Button
            size="sm"
            className="h-8 border border-[#D5D9D9] bg-white px-3 text-black shadow-sm hover:bg-gray-50"
            onClick={handleStop}
            disabled={isLoading}
          >
            <StopCircleIcon className="mr-1 h-4 w-4 text-[#B12704]" />
            Stop
          </Button>
        ) : (
          <Button
            size="sm"
            className="h-8 border border-[#A88734] bg-[#FF9900] px-3 font-medium text-black shadow-sm hover:bg-[#FA8900]"
            onClick={handleLaunch}
            disabled={isLoading}
          >
            <PlayIcon className="mr-1 h-4 w-4" />
            Launch
          </Button>
        )}

        <div className="ml-auto flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 text-[#565959] hover:bg-gray-100 hover:text-[#0F1111]"
            onClick={handleRegenerateFingerprint}
            disabled={isLoading || isRunning}
            title="Regenerate fingerprint"
          >
            <RefreshCwIcon className="h-4 w-4" />
          </Button>

          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 text-[#565959] hover:bg-gray-100 hover:text-[#0F1111]"
            onClick={() => onEdit(profile)}
            disabled={isLoading}
            title="Edit profile settings"
          >
            <SettingsIcon className="h-4 w-4" />
          </Button>

          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 text-[#565959] hover:bg-red-50 hover:text-[#B12704]"
            onClick={handleDelete}
            disabled={isLoading || isRunning}
            title="Delete profile"
          >
            <Trash2Icon className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Last Launched */}
      {profile.lastLaunchedAt && (
        <div className="mt-2 text-right text-[#565959] text-[10px]">
          Last used: {new Date(profile.lastLaunchedAt).toLocaleDateString()}
        </div>
      )}
    </div>
  )
}
