/**
 * Browser Settings Dialog
 *
 * Allows users to configure which browser to use for launching profiles.
 */

import {
  CheckCircleIcon,
  CheckIcon,
  FolderOpenIcon,
  InfoIcon,
  Loader2Icon,
  XCircleIcon,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type {
  AvailableBrowser,
  BrowserConfig,
  BrowserType,
} from '../../../shared/types'

interface BrowserSettingsDialogProps {
  open: boolean
  onClose: () => void
}

export function BrowserSettingsDialog({
  open,
  onClose,
}: BrowserSettingsDialogProps) {
  const [availableBrowsers, setAvailableBrowsers] = useState<
    AvailableBrowser[]
  >([])
  const [currentConfig, setCurrentConfig] = useState<BrowserConfig | null>(null)
  const [selectedPath, setSelectedPath] = useState<string>('auto')
  const [customPath, setCustomPath] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadSettings = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [browsers, config] = await Promise.all([
        window.electronAPI.listAvailableBrowsers(),
        window.electronAPI.getBrowserSettings(),
      ])

      setAvailableBrowsers(browsers)
      setCurrentConfig(config)

      // Set selected path based on current config
      if (config.customBrowserPath) {
        const matchingBrowser = browsers.find(
          (b) => b.path === config.customBrowserPath,
        )
        if (matchingBrowser) {
          setSelectedPath(config.customBrowserPath)
        } else {
          setSelectedPath('custom')
          setCustomPath(config.customBrowserPath)
        }
      } else {
        setSelectedPath('auto')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings')
    } finally {
      setIsLoading(false)
    }
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: loadSettings is stable in practice
  useEffect(() => {
    if (open) {
      loadSettings()
    }
  }, [open])

  const handleSave = async () => {
    setIsSaving(true)
    setError(null)

    try {
      if (selectedPath === 'auto') {
        // Clear custom path, use auto-detection
        await window.electronAPI.clearBrowserSettings()
      } else if (selectedPath === 'custom') {
        // Set custom path
        if (!customPath.trim()) {
          setError('Please enter a valid browser path')
          setIsSaving(false)
          return
        }
        await window.electronAPI.setBrowserSettings(customPath.trim())
      } else {
        // Set selected browser
        const browser = availableBrowsers.find((b) => b.path === selectedPath)
        await window.electronAPI.setBrowserSettings(selectedPath, {
          browserType: browser?.type,
        })
      }

      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings')
    } finally {
      setIsSaving(false)
    }
  }

  const handleBrowse = async () => {
    try {
      const result = await window.electronAPI.openFileDialog({
        filters: [{ name: 'Applications', extensions: ['app', 'exe', ''] }],
        properties: ['openFile'],
      })

      if (result && result.length > 0) {
        setCustomPath(result[0])
        setSelectedPath('custom')
      }
    } catch (err) {
      console.error('Failed to open file dialog:', err)
    }
  }

  // Get browser icon based on type
  const getBrowserIcon = (type: BrowserType) => {
    switch (type) {
      case 'nova-seller':
        return '🛒'
      case 'browseros':
        return '🌐'
      case 'zen-browser':
        return '🦊'
      case 'chrome':
        return '🔵'
      case 'chromium':
        return '⚪'
      default:
        return '🌐'
    }
  }

  // Get current active browser display
  const getActiveBrowserDisplay = () => {
    if (!currentConfig) return 'Auto-detect'
    if (currentConfig.customBrowserPath) {
      const browser = availableBrowsers.find(
        (b) => b.path === currentConfig.customBrowserPath,
      )
      return browser?.name || 'Custom'
    }
    return 'Auto-detect'
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="font-semibold text-lg">
            Browser Settings
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2Icon className="h-6 w-6 animate-spin text-foreground/40" />
            <span className="ml-2 text-foreground/50">Loading...</span>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Info banner */}
            <div className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 p-3 text-blue-800 text-sm">
              <InfoIcon className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <div>
                Select which browser to use when launching profiles. Nova Seller
                and BrowserOS provide better fingerprint protection.
              </div>
            </div>

            {/* Current selection */}
            <div className="text-foreground/50 text-sm">
              Current:{' '}
              <span className="font-medium text-foreground/70">
                {getActiveBrowserDisplay()}
              </span>
            </div>

            {/* Browser selection */}
            <div className="space-y-2">
              <Label className="font-medium text-sm">Select Browser</Label>

              <div className="space-y-2">
                {/* Auto-detect option */}
                <button
                  type="button"
                  onClick={() => setSelectedPath('auto')}
                  className={`flex w-full items-center gap-3 rounded-md border p-3 text-left transition-colors ${
                    selectedPath === 'auto'
                      ? 'border-accent bg-accent/10'
                      : 'border-foreground/10 hover:bg-foreground/5'
                  }`}
                >
                  <div
                    className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                      selectedPath === 'auto'
                        ? 'border-accent bg-accent'
                        : 'border-foreground/20'
                    }`}
                  >
                    {selectedPath === 'auto' && (
                      <CheckIcon className="h-3 w-3 text-white" />
                    )}
                  </div>
                  <span className="text-lg">🔍</span>
                  <div className="flex-1">
                    <div className="font-medium">Auto-detect</div>
                    <div className="text-foreground/50 text-xs">
                      Automatically find the best available browser
                    </div>
                  </div>
                </button>

                {/* Available browsers */}
                {availableBrowsers.map((browser) => (
                  <button
                    key={browser.path}
                    type="button"
                    onClick={() => setSelectedPath(browser.path)}
                    className={`flex w-full items-center gap-3 rounded-md border p-3 text-left transition-colors ${
                      selectedPath === browser.path
                        ? 'border-accent bg-accent/10'
                        : 'border-foreground/10 hover:bg-foreground/5'
                    }`}
                  >
                    <div
                      className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                        selectedPath === browser.path
                          ? 'border-accent bg-accent'
                          : 'border-foreground/20'
                      }`}
                    >
                      {selectedPath === browser.path && (
                        <CheckIcon className="h-3 w-3 text-white" />
                      )}
                    </div>
                    <span className="text-lg">
                      {getBrowserIcon(browser.type)}
                    </span>
                    <div className="min-w-0 flex-1 overflow-hidden">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{browser.name}</span>
                        {browser.isInstalled ? (
                          <CheckCircleIcon className="h-4 w-4 flex-shrink-0 text-green-500" />
                        ) : (
                          <XCircleIcon className="h-4 w-4 flex-shrink-0 text-red-500" />
                        )}
                      </div>
                      <div
                        className="truncate text-foreground/50 text-xs"
                        title={browser.path}
                      >
                        {browser.path}
                      </div>
                    </div>
                  </button>
                ))}

                {/* Custom path option */}
                <button
                  type="button"
                  onClick={() => setSelectedPath('custom')}
                  className={`flex w-full items-center gap-3 rounded-md border p-3 text-left transition-colors ${
                    selectedPath === 'custom'
                      ? 'border-accent bg-accent/10'
                      : 'border-foreground/10 hover:bg-foreground/5'
                  }`}
                >
                  <div
                    className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                      selectedPath === 'custom'
                        ? 'border-accent bg-accent'
                        : 'border-foreground/20'
                    }`}
                  >
                    {selectedPath === 'custom' && (
                      <CheckIcon className="h-3 w-3 text-white" />
                    )}
                  </div>
                  <span className="text-lg">📁</span>
                  <div className="font-medium">Custom Path</div>
                </button>
              </div>

              {/* Custom path input */}
              {selectedPath === 'custom' && (
                <div className="ml-8 flex gap-2">
                  <Input
                    value={customPath}
                    onChange={(e) => setCustomPath(e.target.value)}
                    placeholder="/path/to/browser"
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleBrowse}
                  >
                    <FolderOpenIcon className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>

            {/* Error message */}
            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-red-600 text-sm">
                {error}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isLoading || isSaving}
            className="bg-accent text-white hover:bg-accent/90"
          >
            {isSaving ? (
              <>
                <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
