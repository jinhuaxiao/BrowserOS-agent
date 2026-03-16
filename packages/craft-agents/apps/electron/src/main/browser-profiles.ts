/**
 * Browser Profiles IPC Handlers
 *
 * Handles IPC calls for browser profile management.
 */

import { existsSync } from 'node:fs'
import { platform } from 'node:os'
import {
  batchCreateFromTemplate,
  checkAllProxiesHealth,
  checkProxyHealth,
  clearCustomBrowserPath,
  createGroup,
  createProfile,
  createProfileFromTemplate,
  createProxy,
  createTemplate,
  deleteGroup,
  deleteProfile,
  deleteProxy,
  deleteTemplate,
  detectAndUpdateProxyGeoLocation,
  getBrowserConfig,
  getGroup,
  getProfile,
  getProfileMcpPort,
  getProfilesInGroup,
  getProfilesUsingProxy,
  getProxy,
  getRunningProfiles,
  getTemplate,
  importProxies,
  // Launcher
  launchBrowser,
  // Group operations
  listGroups,
  // Profile operations
  listProfiles,
  // Proxy pool operations
  listProxies,
  // Template operations
  listTemplates,
  // Migration
  migrateToProxyPool,
  moveProfileToGroup,
  needsMigration,
  refreshAllProxiesGeoLocation,
  regenerateFingerprint,
  setBrowserPath,
  stopBrowser,
  testProxyConnection,
  updateGroup,
  updateProfile,
  updateProxy,
  updateTemplate,
} from '@craft-agent/shared/browser-profiles'
import { ipcMain } from 'electron'
import type {
  AvailableBrowser,
  BrowserType,
  CreateGroupInput,
  CreateProfileInput,
  CreateProxyInput,
  CreateTemplateInput,
  UpdateGroupInput,
  UpdateProfileInput,
  UpdateProxyInput,
  UpdateTemplateInput,
} from '../shared/types'
import { IPC_CHANNELS } from '../shared/types'
import { ipcLog } from './logger'

/**
 * Register browser profile IPC handlers
 */
export function registerBrowserProfileHandlers(): void {
  // List all browser profiles
  ipcMain.handle(IPC_CHANNELS.BROWSER_PROFILES_LIST, async () => {
    try {
      return listProfiles()
    } catch (error) {
      ipcLog.error('Failed to list browser profiles:', error)
      throw error
    }
  })

  // Get a single browser profile
  ipcMain.handle(
    IPC_CHANNELS.BROWSER_PROFILES_GET,
    async (_event, profileId: string) => {
      try {
        return getProfile(profileId)
      } catch (error) {
        ipcLog.error(`Failed to get browser profile ${profileId}:`, error)
        throw error
      }
    },
  )

  // Create a new browser profile
  ipcMain.handle(
    IPC_CHANNELS.BROWSER_PROFILES_CREATE,
    async (_event, input: CreateProfileInput) => {
      try {
        const profile = await createProfile(input)
        ipcLog.info(`Created browser profile: ${profile.name} (${profile.id})`)
        return profile
      } catch (error) {
        ipcLog.error('Failed to create browser profile:', error)
        throw error
      }
    },
  )

  // Update a browser profile
  ipcMain.handle(
    IPC_CHANNELS.BROWSER_PROFILES_UPDATE,
    async (_event, profileId: string, input: UpdateProfileInput) => {
      try {
        const profile = updateProfile(profileId, input)
        if (profile) {
          ipcLog.info(
            `Updated browser profile: ${profile.name} (${profile.id})`,
          )
        }
        return profile
      } catch (error) {
        ipcLog.error(`Failed to update browser profile ${profileId}:`, error)
        throw error
      }
    },
  )

  // Delete a browser profile
  ipcMain.handle(
    IPC_CHANNELS.BROWSER_PROFILES_DELETE,
    async (_event, profileId: string) => {
      try {
        // Stop the browser if running
        stopBrowser(profileId)
        const deleted = deleteProfile(profileId)
        if (deleted) {
          ipcLog.info(`Deleted browser profile: ${profileId}`)
        }
        return deleted
      } catch (error) {
        ipcLog.error(`Failed to delete browser profile ${profileId}:`, error)
        throw error
      }
    },
  )

  // Launch a browser profile
  ipcMain.handle(
    IPC_CHANNELS.BROWSER_PROFILES_LAUNCH,
    async (_event, profileId: string) => {
      try {
        const profile = getProfile(profileId)
        if (!profile) {
          return { success: false, error: `Profile not found: ${profileId}` }
        }

        const result = await launchBrowser(profile)
        if (result.success) {
          ipcLog.info(
            `Launched browser for profile: ${profile.name} (PID: ${result.pid})`,
          )
        } else {
          ipcLog.error(
            `Failed to launch browser for profile ${profileId}: ${result.error}`,
          )
        }
        return result
      } catch (error) {
        ipcLog.error(`Failed to launch browser profile ${profileId}:`, error)
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        }
      }
    },
  )

  // Stop a running browser profile
  ipcMain.handle(
    IPC_CHANNELS.BROWSER_PROFILES_STOP,
    async (_event, profileId: string) => {
      try {
        const stopped = stopBrowser(profileId)
        if (stopped) {
          ipcLog.info(`Stopped browser for profile: ${profileId}`)
        }
        return stopped
      } catch (error) {
        ipcLog.error(`Failed to stop browser profile ${profileId}:`, error)
        return false
      }
    },
  )

  // Regenerate fingerprint for a profile
  ipcMain.handle(
    IPC_CHANNELS.BROWSER_PROFILES_REGENERATE_FINGERPRINT,
    async (
      _event,
      profileId: string,
      options?: {
        targetPlatform?: 'windows' | 'macos' | 'linux'
        targetRegion?: 'us' | 'eu' | 'asia' | 'oceania'
      },
    ) => {
      try {
        const profile = await regenerateFingerprint(profileId, options)
        if (profile) {
          ipcLog.info(
            `Regenerated fingerprint for profile: ${profile.name} (${profile.id})`,
          )
        }
        return profile
      } catch (error) {
        ipcLog.error(
          `Failed to regenerate fingerprint for profile ${profileId}:`,
          error,
        )
        throw error
      }
    },
  )

  // Get list of running browser profiles
  ipcMain.handle(IPC_CHANNELS.BROWSER_PROFILES_GET_RUNNING, async () => {
    try {
      return getRunningProfiles()
    } catch (error) {
      ipcLog.error('Failed to get running browser profiles:', error)
      return []
    }
  })

  // Batch create browser profiles
  ipcMain.handle(
    IPC_CHANNELS.BROWSER_PROFILES_BATCH_CREATE,
    async (_event, inputs: CreateProfileInput[]) => {
      try {
        const profiles = await Promise.all(
          inputs.map((input) => createProfile(input)),
        )
        ipcLog.info(`Batch created ${profiles.length} browser profiles`)
        return profiles
      } catch (error) {
        ipcLog.error('Failed to batch create browser profiles:', error)
        throw error
      }
    },
  )

  // Get MCP port for a running profile
  ipcMain.handle(
    IPC_CHANNELS.BROWSER_PROFILES_GET_MCP_PORT,
    async (_event, profileId: string) => {
      try {
        return getProfileMcpPort(profileId)
      } catch (error) {
        ipcLog.error(`Failed to get MCP port for profile ${profileId}:`, error)
        throw error
      }
    },
  )

  // ============================================================================
  // Proxy Pool Handlers
  // ============================================================================

  // List all proxies
  ipcMain.handle(IPC_CHANNELS.PROXY_POOL_LIST, async () => {
    try {
      return listProxies()
    } catch (error) {
      ipcLog.error('Failed to list proxies:', error)
      throw error
    }
  })

  // Get a single proxy
  ipcMain.handle(
    IPC_CHANNELS.PROXY_POOL_GET,
    async (_event, proxyId: string) => {
      try {
        return getProxy(proxyId)
      } catch (error) {
        ipcLog.error(`Failed to get proxy ${proxyId}:`, error)
        throw error
      }
    },
  )

  // Create a new proxy
  ipcMain.handle(
    IPC_CHANNELS.PROXY_POOL_CREATE,
    async (_event, input: CreateProxyInput) => {
      try {
        const proxy = createProxy(input)
        ipcLog.info(`Created proxy: ${proxy.name} (${proxy.id})`)
        return proxy
      } catch (error) {
        ipcLog.error('Failed to create proxy:', error)
        throw error
      }
    },
  )

  // Update a proxy
  ipcMain.handle(
    IPC_CHANNELS.PROXY_POOL_UPDATE,
    async (_event, proxyId: string, input: UpdateProxyInput) => {
      try {
        const proxy = updateProxy(proxyId, input)
        if (proxy) {
          ipcLog.info(`Updated proxy: ${proxy.name} (${proxy.id})`)
        }
        return proxy
      } catch (error) {
        ipcLog.error(`Failed to update proxy ${proxyId}:`, error)
        throw error
      }
    },
  )

  // Delete a proxy
  ipcMain.handle(
    IPC_CHANNELS.PROXY_POOL_DELETE,
    async (_event, proxyId: string) => {
      try {
        const deleted = deleteProxy(proxyId)
        if (deleted) {
          ipcLog.info(`Deleted proxy: ${proxyId}`)
        }
        return deleted
      } catch (error) {
        ipcLog.error(`Failed to delete proxy ${proxyId}:`, error)
        throw error
      }
    },
  )

  // Import proxies
  ipcMain.handle(
    IPC_CHANNELS.PROXY_POOL_IMPORT,
    async (
      _event,
      lines: string[],
      options?: {
        defaultType?: 'socks5' | 'http' | 'https'
        tags?: string[]
        region?: string
        provider?: string
      },
    ) => {
      try {
        const result = importProxies(lines, options)
        ipcLog.info(
          `Imported ${result.success} proxies (${result.failed} failed)`,
        )
        return result
      } catch (error) {
        ipcLog.error('Failed to import proxies:', error)
        throw error
      }
    },
  )

  // Check single proxy health
  ipcMain.handle(
    IPC_CHANNELS.PROXY_POOL_CHECK_HEALTH,
    async (_event, proxyId: string) => {
      try {
        return await checkProxyHealth(proxyId)
      } catch (error) {
        ipcLog.error(`Failed to check proxy health ${proxyId}:`, error)
        throw error
      }
    },
  )

  // Check all proxies health
  ipcMain.handle(IPC_CHANNELS.PROXY_POOL_CHECK_ALL_HEALTH, async () => {
    try {
      return await checkAllProxiesHealth()
    } catch (error) {
      ipcLog.error('Failed to check all proxies health:', error)
      throw error
    }
  })

  // Get profiles using a proxy
  ipcMain.handle(
    IPC_CHANNELS.PROXY_POOL_GET_PROFILES_USING,
    async (_event, proxyId: string) => {
      try {
        return getProfilesUsingProxy(proxyId)
      } catch (error) {
        ipcLog.error(`Failed to get profiles using proxy ${proxyId}:`, error)
        throw error
      }
    },
  )

  // Test proxy connection without saving
  ipcMain.handle(
    IPC_CHANNELS.PROXY_POOL_TEST_CONNECTION,
    async (_event, config: { host: string; port: number }) => {
      try {
        return await testProxyConnection(config)
      } catch (error) {
        ipcLog.error('Failed to test proxy connection:', error)
        throw error
      }
    },
  )

  // Detect geolocation for a proxy
  ipcMain.handle(
    IPC_CHANNELS.PROXY_POOL_DETECT_GEO,
    async (_event, proxyId: string) => {
      try {
        const geoLocation = await detectAndUpdateProxyGeoLocation(proxyId)
        if (geoLocation) {
          ipcLog.info(
            `Detected geolocation for proxy ${proxyId}: ${geoLocation.city}, ${geoLocation.country}`,
          )
        }
        return geoLocation
      } catch (error) {
        ipcLog.error(
          `Failed to detect geolocation for proxy ${proxyId}:`,
          error,
        )
        throw error
      }
    },
  )

  // Refresh geolocation for all proxies
  ipcMain.handle(IPC_CHANNELS.PROXY_POOL_REFRESH_ALL_GEO, async () => {
    try {
      const result = await refreshAllProxiesGeoLocation()
      ipcLog.info(
        `Refreshed geolocation: ${result.success}/${result.total} successful`,
      )
      return result
    } catch (error) {
      ipcLog.error('Failed to refresh all proxies geolocation:', error)
      throw error
    }
  })

  // ============================================================================
  // Profile Groups Handlers
  // ============================================================================

  // List all groups
  ipcMain.handle(IPC_CHANNELS.PROFILE_GROUPS_LIST, async () => {
    try {
      return listGroups()
    } catch (error) {
      ipcLog.error('Failed to list profile groups:', error)
      throw error
    }
  })

  // Get a single group
  ipcMain.handle(
    IPC_CHANNELS.PROFILE_GROUPS_GET,
    async (_event, groupId: string) => {
      try {
        return getGroup(groupId)
      } catch (error) {
        ipcLog.error(`Failed to get profile group ${groupId}:`, error)
        throw error
      }
    },
  )

  // Create a new group
  ipcMain.handle(
    IPC_CHANNELS.PROFILE_GROUPS_CREATE,
    async (_event, input: CreateGroupInput) => {
      try {
        const group = createGroup(input)
        ipcLog.info(`Created profile group: ${group.name} (${group.id})`)
        return group
      } catch (error) {
        ipcLog.error('Failed to create profile group:', error)
        throw error
      }
    },
  )

  // Update a group
  ipcMain.handle(
    IPC_CHANNELS.PROFILE_GROUPS_UPDATE,
    async (_event, groupId: string, input: UpdateGroupInput) => {
      try {
        const group = updateGroup(groupId, input)
        if (group) {
          ipcLog.info(`Updated profile group: ${group.name} (${group.id})`)
        }
        return group
      } catch (error) {
        ipcLog.error(`Failed to update profile group ${groupId}:`, error)
        throw error
      }
    },
  )

  // Delete a group
  ipcMain.handle(
    IPC_CHANNELS.PROFILE_GROUPS_DELETE,
    async (_event, groupId: string) => {
      try {
        const deleted = deleteGroup(groupId)
        if (deleted) {
          ipcLog.info(`Deleted profile group: ${groupId}`)
        }
        return deleted
      } catch (error) {
        ipcLog.error(`Failed to delete profile group ${groupId}:`, error)
        throw error
      }
    },
  )

  // Get profiles in a group
  ipcMain.handle(
    IPC_CHANNELS.PROFILE_GROUPS_GET_PROFILES,
    async (_event, groupId: string) => {
      try {
        return getProfilesInGroup(groupId)
      } catch (error) {
        ipcLog.error(`Failed to get profiles in group ${groupId}:`, error)
        throw error
      }
    },
  )

  // Move profile to group
  ipcMain.handle(
    IPC_CHANNELS.PROFILE_GROUPS_MOVE_PROFILE,
    async (_event, profileId: string, groupId: string | undefined) => {
      try {
        const moved = moveProfileToGroup(profileId, groupId)
        if (moved) {
          ipcLog.info(
            `Moved profile ${profileId} to group ${groupId || 'none'}`,
          )
        }
        return moved
      } catch (error) {
        ipcLog.error(`Failed to move profile ${profileId} to group:`, error)
        throw error
      }
    },
  )

  // ============================================================================
  // Profile Templates Handlers
  // ============================================================================

  // List all templates
  ipcMain.handle(IPC_CHANNELS.PROFILE_TEMPLATES_LIST, async () => {
    try {
      return listTemplates()
    } catch (error) {
      ipcLog.error('Failed to list profile templates:', error)
      throw error
    }
  })

  // Get a single template
  ipcMain.handle(
    IPC_CHANNELS.PROFILE_TEMPLATES_GET,
    async (_event, templateId: string) => {
      try {
        return getTemplate(templateId)
      } catch (error) {
        ipcLog.error(`Failed to get profile template ${templateId}:`, error)
        throw error
      }
    },
  )

  // Create a new template
  ipcMain.handle(
    IPC_CHANNELS.PROFILE_TEMPLATES_CREATE,
    async (_event, input: CreateTemplateInput) => {
      try {
        const template = createTemplate(input)
        ipcLog.info(
          `Created profile template: ${template.name} (${template.id})`,
        )
        return template
      } catch (error) {
        ipcLog.error('Failed to create profile template:', error)
        throw error
      }
    },
  )

  // Update a template
  ipcMain.handle(
    IPC_CHANNELS.PROFILE_TEMPLATES_UPDATE,
    async (_event, templateId: string, input: UpdateTemplateInput) => {
      try {
        const template = updateTemplate(templateId, input)
        if (template) {
          ipcLog.info(
            `Updated profile template: ${template.name} (${template.id})`,
          )
        }
        return template
      } catch (error) {
        ipcLog.error(`Failed to update profile template ${templateId}:`, error)
        throw error
      }
    },
  )

  // Delete a template
  ipcMain.handle(
    IPC_CHANNELS.PROFILE_TEMPLATES_DELETE,
    async (_event, templateId: string) => {
      try {
        const deleted = deleteTemplate(templateId)
        if (deleted) {
          ipcLog.info(`Deleted profile template: ${templateId}`)
        }
        return deleted
      } catch (error) {
        ipcLog.error(`Failed to delete profile template ${templateId}:`, error)
        throw error
      }
    },
  )

  // Create profile from template
  ipcMain.handle(
    IPC_CHANNELS.PROFILE_TEMPLATES_CREATE_PROFILE,
    async (
      _event,
      templateId: string,
      overrides?: Partial<CreateProfileInput>,
    ) => {
      try {
        const profile = await createProfileFromTemplate(templateId, overrides)
        ipcLog.info(
          `Created profile from template: ${profile.name} (${profile.id})`,
        )
        return profile
      } catch (error) {
        ipcLog.error(
          `Failed to create profile from template ${templateId}:`,
          error,
        )
        throw error
      }
    },
  )

  // Batch create from template
  ipcMain.handle(
    IPC_CHANNELS.PROFILE_TEMPLATES_BATCH_CREATE,
    async (
      _event,
      templateId: string,
      count: number,
      options?: { namePrefix?: string; groupId?: string; proxyIds?: string[] },
    ) => {
      try {
        const profiles = await batchCreateFromTemplate(
          templateId,
          count,
          options,
        )
        ipcLog.info(
          `Batch created ${profiles.length} profiles from template ${templateId}`,
        )
        return profiles
      } catch (error) {
        ipcLog.error(
          `Failed to batch create from template ${templateId}:`,
          error,
        )
        throw error
      }
    },
  )

  // ============================================================================
  // Migration Handlers
  // ============================================================================

  // Check if migration is needed
  ipcMain.handle(IPC_CHANNELS.BROWSER_PROFILES_NEEDS_MIGRATION, async () => {
    try {
      return needsMigration()
    } catch (error) {
      ipcLog.error('Failed to check migration status:', error)
      return false
    }
  })

  // Run migration
  ipcMain.handle(IPC_CHANNELS.BROWSER_PROFILES_MIGRATE, async () => {
    try {
      const result = migrateToProxyPool()
      ipcLog.info(
        `Migration completed: ${result.migratedProfiles} profiles, ${result.uniqueProxies} unique proxies`,
      )
      return result
    } catch (error) {
      ipcLog.error('Failed to migrate to proxy pool:', error)
      throw error
    }
  })

  // ============================================================================
  // Browser Settings Handlers
  // ============================================================================

  // Get browser settings
  ipcMain.handle(IPC_CHANNELS.BROWSER_SETTINGS_GET, async () => {
    try {
      return getBrowserConfig()
    } catch (error) {
      ipcLog.error('Failed to get browser settings:', error)
      throw error
    }
  })

  // Set browser path
  ipcMain.handle(
    IPC_CHANNELS.BROWSER_SETTINGS_SET,
    async (
      _event,
      browserPath: string,
      options?: { browserType?: BrowserType; useCustomPathOnly?: boolean },
    ) => {
      try {
        setBrowserPath(browserPath, {
          browserType: options?.browserType,
          useCustomPathOnly: options?.useCustomPathOnly,
        })
        ipcLog.info(`Browser path set to: ${browserPath}`)
      } catch (error) {
        ipcLog.error('Failed to set browser path:', error)
        throw error
      }
    },
  )

  // Clear browser settings
  ipcMain.handle(IPC_CHANNELS.BROWSER_SETTINGS_CLEAR, async () => {
    try {
      clearCustomBrowserPath()
      ipcLog.info('Browser settings cleared')
    } catch (error) {
      ipcLog.error('Failed to clear browser settings:', error)
      throw error
    }
  })

  // List available browsers
  ipcMain.handle(IPC_CHANNELS.BROWSER_SETTINGS_LIST_AVAILABLE, async () => {
    try {
      return listAvailableBrowsers()
    } catch (error) {
      ipcLog.error('Failed to list available browsers:', error)
      throw error
    }
  })

  ipcLog.info('Browser profile IPC handlers registered')
}

/**
 * Get list of available browsers on the system
 */
function listAvailableBrowsers(): AvailableBrowser[] {
  const currentPlatform = platform()
  // Define browser paths by platform
  const browserPaths: Record<
    string,
    Array<{ path: string; name: string; type: BrowserType }>
  > = {
    darwin: [
      {
        path: '/Applications/Nova Seller.app/Contents/MacOS/Nova Seller',
        name: 'Nova Seller',
        type: 'nova-seller',
      },
      {
        path: '/Applications/Nova Seller Dev.app/Contents/MacOS/Nova Seller Dev',
        name: 'Nova Seller Dev',
        type: 'nova-seller',
      },
      {
        path: '/Applications/NovaSeller.app/Contents/MacOS/NovaSeller',
        name: 'Nova Seller',
        type: 'nova-seller',
      },
      {
        path: '/Applications/BrowserOS.app/Contents/MacOS/BrowserOS',
        name: 'BrowserOS',
        type: 'browseros',
      },
      {
        path: '/Applications/Zen Browser.app/Contents/MacOS/zen',
        name: 'Zen Browser',
        type: 'zen-browser',
      },
      {
        path: '/Applications/Now.app/Contents/MacOS/zen',
        name: 'Now Browser',
        type: 'zen-browser',
      },
      {
        path: '/Applications/Chromium.app/Contents/MacOS/Chromium',
        name: 'Chromium',
        type: 'chromium',
      },
      {
        path: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        name: 'Google Chrome',
        type: 'chrome',
      },
    ],
    linux: [
      {
        path: '/usr/bin/nova-seller',
        name: 'Nova Seller',
        type: 'nova-seller',
      },
      {
        path: '/opt/nova-seller/nova-seller',
        name: 'Nova Seller',
        type: 'nova-seller',
      },
      { path: '/usr/bin/browseros', name: 'BrowserOS', type: 'browseros' },
      { path: '/usr/bin/chromium', name: 'Chromium', type: 'chromium' },
      { path: '/usr/bin/chromium-browser', name: 'Chromium', type: 'chromium' },
      { path: '/usr/bin/google-chrome', name: 'Google Chrome', type: 'chrome' },
      {
        path: '/usr/bin/google-chrome-stable',
        name: 'Google Chrome',
        type: 'chrome',
      },
    ],
    win32: [
      {
        path: 'C:\\Program Files\\Nova Seller\\Nova Seller.exe',
        name: 'Nova Seller',
        type: 'nova-seller',
      },
      {
        path: 'C:\\Program Files\\BrowserOS\\BrowserOS.exe',
        name: 'BrowserOS',
        type: 'browseros',
      },
      {
        path: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        name: 'Google Chrome',
        type: 'chrome',
      },
      {
        path: 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        name: 'Google Chrome',
        type: 'chrome',
      },
    ],
  }

  const platformBrowsers = browserPaths[currentPlatform] || []

  // Check each browser path and return available ones
  const seen = new Set<string>()
  const result: AvailableBrowser[] = []

  for (const browser of platformBrowsers) {
    // Skip duplicates (same name)
    if (seen.has(browser.name)) continue

    const isInstalled = existsSync(browser.path)
    if (isInstalled) {
      seen.add(browser.name)
      result.push({
        name: browser.name,
        path: browser.path,
        type: browser.type,
        isInstalled: true,
      })
    }
  }

  // Also add currently configured browser if not in the list
  const currentConfig = getBrowserConfig()
  if (
    currentConfig.customBrowserPath &&
    !result.find((b) => b.path === currentConfig.customBrowserPath)
  ) {
    result.push({
      name: 'Custom Browser',
      path: currentConfig.customBrowserPath,
      type: currentConfig.browserType || 'auto',
      isInstalled: existsSync(currentConfig.customBrowserPath),
    })
  }

  return result
}
