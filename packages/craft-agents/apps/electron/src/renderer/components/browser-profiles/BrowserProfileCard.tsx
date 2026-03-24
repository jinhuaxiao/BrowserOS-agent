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
  DownloadIcon,
  LinkIcon,
  PlayIcon,
  RefreshCwIcon,
  SettingsIcon,
  StopCircleIcon,
  Trash2Icon,
  UserPlusIcon,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useTeamSession } from '@/contexts/TeamContext'
import { usePermissions } from '@/hooks/use-permissions'
import type { BrowserProfileConfig, LaunchResult } from '../../../shared/types'
import { ProfileAssignmentDialog } from '../team/ProfileAssignmentDialog'

interface ProfileAssignee {
  memberId: string
  name: string
  permissions: string
}

interface BrowserProfileCardProps {
  profile: BrowserProfileConfig
  isRunning: boolean
  onLaunch: (profileId: string) => Promise<LaunchResult>
  onStop: (profileId: string) => Promise<boolean>
  onDelete: (profileId: string) => Promise<boolean>
  onRefresh: () => void
  onEdit: (profile: BrowserProfileConfig) => void
  assignees?: ProfileAssignee[]
  canLaunch?: boolean
  canDelete?: boolean
  canEdit?: boolean
}

interface McpToolInfo {
  name: string
  description?: string
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: complex UI component
export function BrowserProfileCard({
  profile,
  isRunning,
  onLaunch,
  onStop,
  onDelete,
  onRefresh,
  onEdit,
  assignees = [],
  canLaunch = true,
  canDelete = true,
  canEdit = true,
}: BrowserProfileCardProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAssignDialog, setShowAssignDialog] = useState(false)
  const session = useTeamSession()
  const permissions = usePermissions()
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
    if (
      !confirm(
        `Move "${profile.name}" to trash? You can restore it within 30 days.`,
      )
    ) {
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

  const handleExportCookies = async () => {
    if (!mcpPort) return
    setIsLoading(true)
    setError(null)
    try {
      // CDP port is typically mcpPort - 100 (9000-9099 range for CDP)
      const cdpPort = mcpPort ? mcpPort - 100 : undefined
      const text = await window.electronAPI.exportCookies(
        profile.id,
        'json',
        cdpPort,
      )
      await navigator.clipboard.writeText(text)
      setCopiedField('cookies')
      setTimeout(() => setCopiedField(null), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export cookies')
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
      className={`flex h-full flex-col rounded border bg-background p-4 ${isRunning ? 'border-success/50 shadow-md' : 'border-foreground/10 shadow-minimal hover:shadow-middle'}
        ${isLoading ? 'opacity-75' : ''}transition-shadow duration-200`}
    >
      {/* Header */}
      <div className="mb-3 flex items-start justify-between">
        <div className="flex items-center gap-2">
          {profile.serialNumber && (
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent font-bold text-background text-xs">
              {profile.serialNumber}
            </span>
          )}
          <div>
            <h3 className="cursor-pointer font-bold text-accent text-lg leading-tight hover:underline">
              {profile.name}
            </h3>
            <p className="mt-0.5 font-medium text-foreground/50 text-xs">
              {getPlatformLabel(profile.platform)}
            </p>
          </div>
        </div>
        <div
          className={`border px-2 py-0.5 font-bold text-[10px] uppercase tracking-wide ${
            isRunning
              ? 'border-success/30 bg-success/10 text-success'
              : 'border-foreground/10 bg-foreground/5 text-foreground/50'
          }
          `}
        >
          {isRunning ? 'Running' : 'Idle'}
        </div>
      </div>

      {/* Description */}
      {profile.description && (
        <p className="mb-3 line-clamp-2 text-foreground text-sm">
          {profile.description}
        </p>
      )}

      {/* Fingerprint Info - Data Table Style */}
      {profile.fingerprint && (
        <div className="mb-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
          <span className="font-bold text-foreground/50">UA:</span>
          <span
            className="truncate text-foreground"
            title={profile.fingerprint.navigator?.userAgent}
          >
            {profile.fingerprint.navigator?.userAgent?.slice(0, 40) || 'N/A'}...
          </span>

          <span className="font-bold text-foreground/50">Screen:</span>
          <span className="text-foreground">
            {profile.fingerprint.screen?.width || 0}x
            {profile.fingerprint.screen?.height || 0}
          </span>

          <span className="font-bold text-foreground/50">Timezone:</span>
          <span className="text-foreground">
            {profile.fingerprint.timezone?.name || 'N/A'}
          </span>
        </div>
      )}

      {/* Proxy Info */}
      {profile.proxy && (
        <div className="mb-3 flex items-center gap-2 text-xs">
          <span className="font-bold text-foreground/50">Proxy:</span>
          <span className="rounded border border-foreground/10 bg-foreground/5 px-1.5 py-0.5 text-foreground">
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
              className="rounded-sm border border-foreground/10 bg-foreground/5 px-2 py-0.5 text-foreground/50 text-xs"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Assignees */}
      {assignees.length > 0 && (
        <div className="mb-3 flex items-center gap-1.5 text-xs">
          <span className="font-bold text-foreground/50">Assigned:</span>
          <div className="flex flex-wrap gap-1">
            {assignees.slice(0, 3).map((a) => (
              <span
                key={a.memberId}
                className="rounded-sm border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-blue-700"
                title={`${a.name} (${a.permissions})`}
              >
                {a.name}
              </span>
            ))}
            {assignees.length > 3 && (
              <span className="text-foreground/50">
                +{assignees.length - 3}
              </span>
            )}
          </div>
        </div>
      )}

      {/* MCP Server Info Panel */}
      {isRunning && mcpUrl && (
        <div className="mb-3 rounded-sm border border-accent/20 bg-accent/5 p-3 text-xs">
          <div className="mb-2 flex items-center gap-1.5">
            <LinkIcon className="h-3.5 w-3.5 text-accent" />
            <span className="font-bold text-accent">MCP Server</span>
            <span
              className={`ml-auto inline-flex items-center gap-1 ${mcpConnected ? 'text-success' : 'text-info'}`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${mcpConnected ? 'bg-success' : 'bg-info'}`}
              />
              {mcpConnected ? 'Connected' : 'Connecting...'}
              {mcpConnected && mcpTools.length > 0 && (
                <span className="ml-1 text-accent">
                  | {mcpTools.length} tools
                </span>
              )}
            </span>
          </div>

          {/* Server URL */}
          <div className="mb-1.5 flex items-center gap-1.5">
            <span className="shrink-0 font-bold text-foreground/50">URL:</span>
            <code className="flex-1 select-all truncate rounded border border-accent/10 bg-background px-1.5 py-0.5 text-foreground">
              {mcpUrl}
            </code>
            <button
              type="button"
              onClick={() => copyToClipboard(mcpUrl, 'url')}
              className="shrink-0 rounded p-0.5 transition-colors hover:bg-accent/10"
              title="Copy URL"
            >
              {copiedField === 'url' ? (
                <CheckIcon className="h-3.5 w-3.5 text-success" />
              ) : (
                <CopyIcon className="h-3.5 w-3.5 text-accent" />
              )}
            </button>
          </div>

          {/* Claude Code command */}
          {claudeCommand && (
            <div className="flex items-center gap-1.5">
              <span className="shrink-0 font-bold text-foreground/50">
                CLI:
              </span>
              <code className="flex-1 select-all truncate rounded border border-accent/10 bg-background px-1.5 py-0.5 text-[10px] text-foreground">
                {claudeCommand}
              </code>
              <button
                type="button"
                onClick={() => copyToClipboard(claudeCommand, 'cli')}
                className="shrink-0 rounded p-0.5 transition-colors hover:bg-accent/10"
                title="Copy Claude Code command"
              >
                {copiedField === 'cli' ? (
                  <CheckIcon className="h-3.5 w-3.5 text-success" />
                ) : (
                  <CopyIcon className="h-3.5 w-3.5 text-accent" />
                )}
              </button>
            </div>
          )}

          {/* Tools list (collapsible) */}
          {mcpTools.length > 0 && (
            <div className="mt-2 border-accent/20 border-t pt-2">
              <button
                type="button"
                onClick={() => setShowTools(!showTools)}
                className="flex items-center gap-1 font-medium text-accent hover:text-accent/80"
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
                      <span className="mt-0.5 text-accent/50">-</span>
                      <span className="font-mono text-foreground">
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
        <div className="mb-3 flex items-center gap-2 rounded-sm border border-destructive/20 bg-destructive/5 p-2 text-destructive text-xs">
          <span className="font-bold">!</span> {error}
        </div>
      )}

      {/* Actions */}
      <div className="mt-auto flex flex-wrap items-center gap-2 border-foreground/5 border-t pt-2">
        {isRunning ? (
          <Button
            size="sm"
            className="h-8 border border-foreground/10 bg-background px-3 text-foreground shadow-sm hover:bg-foreground/5"
            onClick={handleStop}
            disabled={isLoading || !canLaunch}
          >
            <StopCircleIcon className="mr-1 h-4 w-4 text-destructive" />
            Stop
          </Button>
        ) : (
          <Button
            size="sm"
            className="h-8 bg-accent px-3 font-medium text-white shadow-sm hover:bg-accent/90"
            onClick={handleLaunch}
            disabled={isLoading || !canLaunch}
          >
            <PlayIcon className="mr-1 h-4 w-4" />
            Launch
          </Button>
        )}

        <div className="ml-auto flex items-center gap-1">
          {permissions.canAssignProfiles && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 text-foreground/50 hover:bg-accent/10 hover:text-accent"
              onClick={() => setShowAssignDialog(true)}
              disabled={isLoading}
              title="Assign to members"
            >
              <UserPlusIcon className="h-4 w-4" />
            </Button>
          )}

          {isRunning && mcpPort && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 text-foreground/50 hover:bg-info/10 hover:text-info"
              onClick={handleExportCookies}
              disabled={isLoading}
              title={
                copiedField === 'cookies'
                  ? 'Cookies copied!'
                  : 'Export cookies to clipboard'
              }
            >
              {copiedField === 'cookies' ? (
                <CheckIcon className="h-4 w-4 text-success" />
              ) : (
                <DownloadIcon className="h-4 w-4" />
              )}
            </Button>
          )}

          {canEdit && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 text-foreground/50 hover:bg-foreground/5 hover:text-foreground"
              onClick={handleRegenerateFingerprint}
              disabled={isLoading || isRunning}
              title="Regenerate fingerprint"
            >
              <RefreshCwIcon className="h-4 w-4" />
            </Button>
          )}

          {canEdit && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 text-foreground/50 hover:bg-foreground/5 hover:text-foreground"
              onClick={() => onEdit(profile)}
              disabled={isLoading}
              title="Edit profile settings"
            >
              <SettingsIcon className="h-4 w-4" />
            </Button>
          )}

          {canDelete && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 text-foreground/50 hover:bg-destructive/10 hover:text-destructive"
              onClick={handleDelete}
              disabled={isLoading || isRunning}
              title="Delete profile"
            >
              <Trash2Icon className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Last Launched */}
      {profile.lastLaunchedAt && (
        <div className="mt-2 text-right text-[10px] text-foreground/50">
          Last used: {new Date(profile.lastLaunchedAt).toLocaleDateString()}
        </div>
      )}

      {/* Assignment Dialog */}
      {showAssignDialog && session?.organization && (
        <ProfileAssignmentDialog
          profileId={profile.id}
          profileName={profile.name}
          organizationId={session.organization.id}
          onClose={() => setShowAssignDialog(false)}
          onAssigned={() => {
            onRefresh()
            setShowAssignDialog(false)
          }}
        />
      )}
    </div>
  )
}
