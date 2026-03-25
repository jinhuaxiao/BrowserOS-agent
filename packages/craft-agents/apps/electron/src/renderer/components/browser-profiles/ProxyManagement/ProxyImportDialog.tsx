/**
 * Proxy Import Dialog Component
 *
 * Dialog for bulk importing proxies from text.
 */

import { CheckCircleIcon, XCircleIcon, XIcon } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import type {
  ProxyImportResult,
  ProxyRegion,
  SavedProxy,
} from '../../../../shared/types'

interface ProxyImportDialogProps {
  onClose: () => void
  onImported: (proxies: SavedProxy[]) => void
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

export function ProxyImportDialog({
  onClose,
  onImported,
}: ProxyImportDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ProxyImportResult | null>(null)

  // Form state
  const [proxyText, setProxyText] = useState('')
  const [defaultType, setDefaultType] = useState<'socks5' | 'http' | 'https'>(
    'socks5',
  )
  const [region, setRegion] = useState<ProxyRegion | ''>('')
  const [provider, setProvider] = useState('')
  const [tags, setTags] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const lines = proxyText
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))

    if (lines.length === 0) {
      setError('Please enter at least one proxy')
      return
    }

    setIsLoading(true)
    setError(null)
    setResult(null)

    try {
      const importResult = await window.electronAPI.importProxies(lines, {
        defaultType,
        region: region || undefined,
        provider: provider.trim() || undefined,
        tags: tags.trim()
          ? tags
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean)
          : undefined,
      })

      setResult(importResult)

      if (importResult.success > 0) {
        // Don't close immediately, let user see the result
        // They can click "Done" to close
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import proxies')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDone = () => {
    if (result && result.proxies.length > 0) {
      onImported(result.proxies)
    } else {
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-bold text-foreground">
            Import Proxies
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
          {/* Proxy text area */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Proxies (one per line)
            </label>
            <textarea
              value={proxyText}
              onChange={(e) => setProxyText(e.target.value)}
              placeholder={`host:port
host:port:username:password
socks5://host:port
http://host:port:user:pass

# Lines starting with # are ignored`}
              rows={8}
              className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 font-mono text-sm focus:border-accent focus:ring-1 focus:ring-accent outline-none"
              disabled={isLoading || !!result}
            />
            <p className="text-xs text-foreground/50 mt-1">
              Supported formats: host:port, host:port:user:pass, or
              type://host:port:user:pass
            </p>
          </div>

          {/* Import options */}
          {!result && (
            <div className="border-t pt-4">
              <h3 className="text-sm font-medium mb-3">Import Options</h3>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-foreground/50 mb-1">
                    Default Type
                  </label>
                  <select
                    value={defaultType}
                    onChange={(e) =>
                      setDefaultType(
                        e.target.value as 'socks5' | 'http' | 'https',
                      )
                    }
                    className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm focus:border-accent focus:ring-1 focus:ring-accent outline-none"
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
                  <label className="block text-xs text-foreground/50 mb-1">
                    Region
                  </label>
                  <select
                    value={region}
                    onChange={(e) =>
                      setRegion(e.target.value as ProxyRegion | '')
                    }
                    className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm focus:border-accent focus:ring-1 focus:ring-accent outline-none"
                    disabled={isLoading}
                  >
                    <option value="">No region</option>
                    {REGIONS.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-3">
                <div>
                  <label className="block text-xs text-foreground/50 mb-1">
                    Provider
                  </label>
                  <input
                    type="text"
                    value={provider}
                    onChange={(e) => setProvider(e.target.value)}
                    placeholder="e.g., Luminati"
                    className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm focus:border-accent focus:ring-1 focus:ring-accent outline-none"
                    disabled={isLoading}
                  />
                </div>
                <div>
                  <label className="block text-xs text-foreground/50 mb-1">
                    Tags
                  </label>
                  <input
                    type="text"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    placeholder="tag1, tag2"
                    className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm focus:border-accent focus:ring-1 focus:ring-accent outline-none"
                    disabled={isLoading}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Import result */}
          {result && (
            <div className="border-t pt-4">
              <h3 className="text-sm font-medium mb-3">Import Result</h3>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-green-500">
                  <CheckCircleIcon className="w-4 h-4" />
                  <span>{result.success} proxies imported successfully</span>
                </div>

                {result.failed > 0 && (
                  <div className="flex items-center gap-2 text-red-500">
                    <XCircleIcon className="w-4 h-4" />
                    <span>{result.failed} failed</span>
                  </div>
                )}

                {result.errors.length > 0 && (
                  <div className="mt-2 p-2 bg-red-500/10 rounded text-sm max-h-32 overflow-y-auto">
                    {result.errors.map((err, i) => (
                      <div key={i} className="text-red-500">
                        Line {err.line}: {err.error}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="text-sm text-red-500 p-2 bg-red-500/10 rounded">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            {!result ? (
              <>
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
                  {isLoading ? 'Importing...' : 'Import'}
                </Button>
              </>
            ) : (
              <Button
                type="button"
                onClick={handleDone}
                className="bg-accent text-white hover:bg-accent/90"
              >
                Done
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
