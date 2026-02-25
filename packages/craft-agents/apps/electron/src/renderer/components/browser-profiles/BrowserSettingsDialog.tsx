/**
 * Browser Settings Dialog
 *
 * Allows users to configure which browser to use for launching profiles.
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  CheckCircleIcon,
  XCircleIcon,
  FolderOpenIcon,
  Loader2Icon,
  InfoIcon,
  CheckIcon,
} from 'lucide-react';
import type { BrowserConfig, AvailableBrowser, BrowserType } from '../../../shared/types';

interface BrowserSettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

export function BrowserSettingsDialog({ open, onClose }: BrowserSettingsDialogProps) {
  const [availableBrowsers, setAvailableBrowsers] = useState<AvailableBrowser[]>([]);
  const [currentConfig, setCurrentConfig] = useState<BrowserConfig | null>(null);
  const [selectedPath, setSelectedPath] = useState<string>('auto');
  const [customPath, setCustomPath] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load available browsers and current config
  useEffect(() => {
    if (open) {
      loadSettings();
    }
  }, [open]);

  const loadSettings = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [browsers, config] = await Promise.all([
        window.electronAPI.listAvailableBrowsers(),
        window.electronAPI.getBrowserSettings(),
      ]);

      setAvailableBrowsers(browsers);
      setCurrentConfig(config);

      // Set selected path based on current config
      if (config.customBrowserPath) {
        const matchingBrowser = browsers.find(b => b.path === config.customBrowserPath);
        if (matchingBrowser) {
          setSelectedPath(config.customBrowserPath);
        } else {
          setSelectedPath('custom');
          setCustomPath(config.customBrowserPath);
        }
      } else {
        setSelectedPath('auto');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    try {
      if (selectedPath === 'auto') {
        // Clear custom path, use auto-detection
        await window.electronAPI.clearBrowserSettings();
      } else if (selectedPath === 'custom') {
        // Set custom path
        if (!customPath.trim()) {
          setError('Please enter a valid browser path');
          setIsSaving(false);
          return;
        }
        await window.electronAPI.setBrowserSettings(customPath.trim());
      } else {
        // Set selected browser
        const browser = availableBrowsers.find(b => b.path === selectedPath);
        await window.electronAPI.setBrowserSettings(selectedPath, {
          browserType: browser?.type,
        });
      }

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleBrowse = async () => {
    try {
      const result = await window.electronAPI.openFileDialog({
        filters: [
          { name: 'Applications', extensions: ['app', 'exe', ''] },
        ],
        properties: ['openFile'],
      });

      if (result && result.length > 0) {
        setCustomPath(result[0]);
        setSelectedPath('custom');
      }
    } catch (err) {
      console.error('Failed to open file dialog:', err);
    }
  };

  // Get browser icon based on type
  const getBrowserIcon = (type: BrowserType) => {
    switch (type) {
      case 'nova-seller':
        return '🛒';
      case 'browseros':
        return '🌐';
      case 'chrome':
        return '🔵';
      case 'chromium':
        return '⚪';
      default:
        return '🌐';
    }
  };

  // Get current active browser display
  const getActiveBrowserDisplay = () => {
    if (!currentConfig) return 'Auto-detect';
    if (currentConfig.customBrowserPath) {
      const browser = availableBrowsers.find(b => b.path === currentConfig.customBrowserPath);
      return browser?.name || 'Custom';
    }
    return 'Auto-detect';
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">Browser Settings</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2Icon className="w-6 h-6 animate-spin text-gray-400" />
            <span className="ml-2 text-gray-500">Loading...</span>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Info banner */}
            <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-800">
              <InfoIcon className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div>
                Select which browser to use when launching profiles.
                Nova Seller and BrowserOS provide better fingerprint protection.
              </div>
            </div>

            {/* Current selection */}
            <div className="text-sm text-gray-500">
              Current: <span className="font-medium text-gray-700">{getActiveBrowserDisplay()}</span>
            </div>

            {/* Browser selection */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Select Browser</Label>

              <div className="space-y-2">
                {/* Auto-detect option */}
                <button
                  type="button"
                  onClick={() => setSelectedPath('auto')}
                  className={`w-full flex items-center gap-3 p-3 border rounded-md text-left transition-colors ${
                    selectedPath === 'auto'
                      ? 'border-[#FF9900] bg-orange-50'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    selectedPath === 'auto' ? 'border-[#FF9900] bg-[#FF9900]' : 'border-gray-300'
                  }`}>
                    {selectedPath === 'auto' && <CheckIcon className="w-3 h-3 text-white" />}
                  </div>
                  <span className="text-lg">🔍</span>
                  <div className="flex-1">
                    <div className="font-medium">Auto-detect</div>
                    <div className="text-xs text-gray-500">
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
                    className={`w-full flex items-center gap-3 p-3 border rounded-md text-left transition-colors ${
                      selectedPath === browser.path
                        ? 'border-[#FF9900] bg-orange-50'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      selectedPath === browser.path ? 'border-[#FF9900] bg-[#FF9900]' : 'border-gray-300'
                    }`}>
                      {selectedPath === browser.path && <CheckIcon className="w-3 h-3 text-white" />}
                    </div>
                    <span className="text-lg">{getBrowserIcon(browser.type)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{browser.name}</span>
                        {browser.isInstalled ? (
                          <CheckCircleIcon className="w-4 h-4 text-green-500 flex-shrink-0" />
                        ) : (
                          <XCircleIcon className="w-4 h-4 text-red-500 flex-shrink-0" />
                        )}
                      </div>
                      <div className="text-xs text-gray-500 truncate">
                        {browser.path}
                      </div>
                    </div>
                  </button>
                ))}

                {/* Custom path option */}
                <button
                  type="button"
                  onClick={() => setSelectedPath('custom')}
                  className={`w-full flex items-center gap-3 p-3 border rounded-md text-left transition-colors ${
                    selectedPath === 'custom'
                      ? 'border-[#FF9900] bg-orange-50'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    selectedPath === 'custom' ? 'border-[#FF9900] bg-[#FF9900]' : 'border-gray-300'
                  }`}>
                    {selectedPath === 'custom' && <CheckIcon className="w-3 h-3 text-white" />}
                  </div>
                  <span className="text-lg">📁</span>
                  <div className="font-medium">Custom Path</div>
                </button>
              </div>

              {/* Custom path input */}
              {selectedPath === 'custom' && (
                <div className="flex gap-2 ml-8">
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
                    <FolderOpenIcon className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>

            {/* Error message */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-600">
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
            className="bg-[#FF9900] hover:bg-[#FA8900] text-black"
          >
            {isSaving ? (
              <>
                <Loader2Icon className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
