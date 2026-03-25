/**
 * Create Proxy Dialog Component
 *
 * Dialog for creating a new proxy in the pool.
 * Supports testing proxy connection before saving.
 */

import { CheckCircleIcon, LoaderIcon, XCircleIcon, XIcon } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import type {
  CreateProxyInput,
  ProxyRegion,
  SavedProxy,
} from '../../../../shared/types'

interface CreateProxyDialogProps {
  onClose: () => void
  onCreated: (proxy: SavedProxy) => void
}

const PROXY_TYPES = [
  { value: 'socks5', label: 'SOCKS5' },
  { value: 'http', label: 'HTTP' },
  { value: 'https', label: 'HTTPS' },
]

const REGIONS: { value: ProxyRegion; label: string }[] = [
  { value: 'us', label: 'United States' },
  { value: 'eu', label: 'Europe' },
  { value: 'asia', label: 'Asia' },
  { value: 'oceania', label: 'Oceania' },
]

export function CreateProxyDialog({
  onClose,
  onCreated,
}: CreateProxyDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<{
    success: boolean
    responseTimeMs?: number
    errorMessage?: string
  } | null>(null)

  // Form state
  const [name, setName] = useState('')
  const [type, setType] = useState<'socks5' | 'http' | 'https'>('socks5')
  const [host, setHost] = useState('')
  const [port, setPort] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [region, setRegion] = useState<ProxyRegion | ''>('')
  const [provider, setProvider] = useState('')
  const [tags, setTags] = useState('')

  // Test proxy connection
  const handleTestConnection = async () => {
    if (!host.trim()) {
      setError('Host is required to test connection')
      return
    }

    if (!port.trim() || isNaN(parseInt(port, 10))) {
      setError('Valid port is required to test connection')
      return
    }

    setIsTesting(true)
    setError(null)
    setTestResult(null)

    try {
      const result = await window.electronAPI.testProxyConnection({
        host: host.trim(),
        port: parseInt(port, 10),
      })
      setTestResult(result)
    } catch (err) {
      setTestResult({
        success: false,
        errorMessage: err instanceof Error ? err.message : 'Test failed',
      })
    } finally {
      setIsTesting(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!host.trim()) {
      setError('Host is required')
      return
    }

    if (!port.trim() || isNaN(parseInt(port, 10))) {
      setError('Valid port is required')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const input: CreateProxyInput = {
        name: name.trim() || `${host}:${port}`,
        type,
        host: host.trim(),
        port: parseInt(port, 10),
        username: username.trim() || undefined,
        password: password.trim() || undefined,
        region: region || undefined,
        provider: provider.trim() || undefined,
        tags: tags.trim()
          ? tags
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean)
          : undefined,
      }

      const proxy = await window.electronAPI.createProxy(input)
      onCreated(proxy)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create proxy')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-serif font-medium text-foreground">
            Add Proxy
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-foreground/50 hover:bg-foreground/5 hover:text-foreground"
          >
            <XIcon className="w-4 h-4" />
          </Button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Name (optional)
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., US Proxy 1"
              className="w-full rounded-md border border-border bg-background px-3 py-2 focus:border-accent focus:ring-1 focus:ring-accent outline-none"
              disabled={isLoading}
            />
            <p className="text-xs text-foreground/50 mt-1">
              Leave empty to use host:port as name
            </p>
          </div>

          {/* Connection details */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Type</label>
              <select
                value={type}
                onChange={(e) =>
                  setType(e.target.value as 'socks5' | 'http' | 'https')
                }
                className="w-full rounded-md border border-border bg-background px-3 py-2 focus:border-accent focus:ring-1 focus:ring-accent outline-none"
                disabled={isLoading}
              >
                {PROXY_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Host *</label>
              <input
                type="text"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="proxy.example.com"
                className="w-full rounded-md border border-border bg-background px-3 py-2 focus:border-accent focus:ring-1 focus:ring-accent outline-none"
                disabled={isLoading}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Port *</label>
              <input
                type="number"
                value={port}
                onChange={(e) => setPort(e.target.value)}
                placeholder="1080"
                className="w-full rounded-md border border-border bg-background px-3 py-2 focus:border-accent focus:ring-1 focus:ring-accent outline-none"
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Test Connection */}
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleTestConnection}
              disabled={isLoading || isTesting || !host.trim() || !port.trim()}
              className="border-border hover:bg-foreground/5"
            >
              {isTesting ? (
                <>
                  <LoaderIcon className="w-4 h-4 mr-1 animate-spin" />
                  Testing...
                </>
              ) : (
                'Test Connection'
              )}
            </Button>
            {testResult && (
              <div
                className={`flex items-center gap-1 text-sm ${testResult.success ? 'text-green-600' : 'text-red-500'}`}
              >
                {testResult.success ? (
                  <>
                    <CheckCircleIcon className="w-4 h-4" />
                    <span>Connected ({testResult.responseTimeMs}ms)</span>
                  </>
                ) : (
                  <>
                    <XCircleIcon className="w-4 h-4" />
                    <span>
                      {testResult.errorMessage || 'Connection failed'}
                    </span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Authentication */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">
                Username (optional)
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 focus:border-accent focus:ring-1 focus:ring-accent outline-none"
                disabled={isLoading}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Password (optional)
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 focus:border-accent focus:ring-1 focus:ring-accent outline-none"
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Organization */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Region</label>
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value as ProxyRegion | '')}
                className="w-full rounded-md border border-border bg-background px-3 py-2 focus:border-accent focus:ring-1 focus:ring-accent outline-none"
                disabled={isLoading}
              >
                <option value="">Select region...</option>
                {REGIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Provider</label>
              <input
                type="text"
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                placeholder="e.g., Luminati"
                className="w-full rounded-md border border-border bg-background px-3 py-2 focus:border-accent focus:ring-1 focus:ring-accent outline-none"
                disabled={isLoading}
              />
            </div>
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
              placeholder="e.g., residential, premium"
              className="w-full rounded-md border border-border bg-background px-3 py-2 focus:border-accent focus:ring-1 focus:ring-accent outline-none"
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
          <div className="flex justify-end gap-2 pt-4 border-t border-border">
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
              {isLoading ? 'Adding...' : 'Add Proxy'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
