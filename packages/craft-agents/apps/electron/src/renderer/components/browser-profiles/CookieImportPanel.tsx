/**
 * Cookie Import Panel Component
 *
 * Collapsible panel for importing cookies via text paste or file upload.
 * Supports JSON and Netscape formats.
 * Used in both Create and Edit profile dialogs.
 */

import {
  CheckCircleIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CookieIcon,
  FileUpIcon,
  Loader2Icon,
  XCircleIcon,
} from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'

interface CookieImportPanelProps {
  profileId?: string
  onCookiesImported?: (count: number) => void
  disabled?: boolean
}

type CookieFormat = 'json' | 'netscape'

export function CookieImportPanel({
  profileId,
  onCookiesImported,
  disabled = false,
}: CookieImportPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [format, setFormat] = useState<CookieFormat>('json')
  const [cookieText, setCookieText] = useState('')
  const [isImporting, setIsImporting] = useState(false)
  const [importResult, setImportResult] = useState<{
    success: boolean
    count?: number
    error?: string
  } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleImport = useCallback(async () => {
    if (!profileId || !cookieText.trim()) return

    setIsImporting(true)
    setImportResult(null)

    try {
      const result = await window.electronAPI.importCookies(
        profileId,
        cookieText,
        format,
      )
      setImportResult({ success: true, count: result.saved })
      onCookiesImported?.(result.saved)
      setTimeout(() => setImportResult(null), 3000)
    } catch (err) {
      setImportResult({
        success: false,
        error: err instanceof Error ? err.message : 'Import failed',
      })
    } finally {
      setIsImporting(false)
    }
  }, [profileId, cookieText, format, onCookiesImported])

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      const reader = new FileReader()
      reader.onload = (event) => {
        const text = event.target?.result as string
        if (text) {
          setCookieText(text)
          // Auto-detect format
          const trimmed = text.trim()
          if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
            setFormat('json')
          } else {
            setFormat('netscape')
          }
        }
      }
      reader.readAsText(file)

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    },
    [],
  )

  return (
    <div className="border-t pt-4">
      <button
        type="button"
        className="flex items-center gap-2 font-medium text-sm hover:text-[#007185] transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {isExpanded ? (
          <ChevronDownIcon className="w-4 h-4" />
        ) : (
          <ChevronRightIcon className="w-4 h-4" />
        )}
        <CookieIcon className="w-4 h-4" />
        Import Cookies
      </button>

      {isExpanded && (
        <div className="mt-3 space-y-3">
          {/* Format selector */}
          <div className="flex items-center gap-3">
            <label className="text-xs text-muted-foreground">Format:</label>
            <div className="flex items-center rounded border border-[#D5D9D9] overflow-hidden">
              <button
                type="button"
                className={`px-3 py-1 text-xs transition-colors ${
                  format === 'json'
                    ? 'bg-[#FF9900] text-black font-medium'
                    : 'text-[#565959] hover:bg-gray-50'
                }`}
                onClick={() => setFormat('json')}
              >
                JSON
              </button>
              <button
                type="button"
                className={`px-3 py-1 text-xs border-l border-[#D5D9D9] transition-colors ${
                  format === 'netscape'
                    ? 'bg-[#FF9900] text-black font-medium'
                    : 'text-[#565959] hover:bg-gray-50'
                }`}
                onClick={() => setFormat('netscape')}
              >
                Netscape
              </button>
            </div>
          </div>

          {/* Cookie text input */}
          <textarea
            value={cookieText}
            onChange={(e) => setCookieText(e.target.value)}
            placeholder={
              format === 'json'
                ? '[{"name": "session", "value": "abc123", "domain": ".example.com", "path": "/"}]'
                : '.example.com\tTRUE\t/\tFALSE\t0\tsession\tabc123'
            }
            rows={4}
            className="w-full resize-none rounded-md border bg-background px-3 py-2 text-xs font-mono"
            disabled={disabled || isImporting}
          />

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleImport}
              disabled={
                disabled || isImporting || !cookieText.trim() || !profileId
              }
              className="text-xs"
            >
              {isImporting ? (
                <Loader2Icon className="w-3.5 h-3.5 mr-1 animate-spin" />
              ) : (
                <CookieIcon className="w-3.5 h-3.5 mr-1" />
              )}
              Import
            </Button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.txt"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || isImporting}
              className="text-xs"
            >
              <FileUpIcon className="w-3.5 h-3.5 mr-1" />
              Upload File
            </Button>

            {/* Result indicator */}
            {importResult && (
              <span
                className={`flex items-center gap-1 text-xs ${
                  importResult.success ? 'text-green-600' : 'text-red-500'
                }`}
              >
                {importResult.success ? (
                  <>
                    <CheckCircleIcon className="w-3.5 h-3.5" />
                    {importResult.count} cookies imported
                  </>
                ) : (
                  <>
                    <XCircleIcon className="w-3.5 h-3.5" />
                    {importResult.error}
                  </>
                )}
              </span>
            )}
          </div>

          {!profileId && (
            <p className="text-xs text-amber-600">
              Save the profile first, then import cookies.
            </p>
          )}

          <p className="text-xs text-muted-foreground">
            Paste cookies from browser extensions (EditThisCookie,
            Cookie-Editor) or Netscape format files. Cookies will be injected
            when the browser launches.
          </p>
        </div>
      )}
    </div>
  )
}
