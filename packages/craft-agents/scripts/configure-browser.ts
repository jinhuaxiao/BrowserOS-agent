#!/usr/bin/env npx ts-node
/**
 * Browser Configuration Script
 *
 * Configure which browser to use for launching profiles.
 *
 * Usage:
 *   npx ts-node scripts/configure-browser.ts set /path/to/browser
 *   npx ts-node scripts/configure-browser.ts clear
 *   npx ts-node scripts/configure-browser.ts show
 *   npx ts-node scripts/configure-browser.ts list
 */

import { existsSync } from 'fs'
import { platform } from 'os'
import {
  clearCustomBrowserPath,
  getBrowserConfig,
  getConfigFilePath,
  setBrowserPath,
} from '../packages/shared/src/browser-profiles/browser-config-storage.ts'
import { findBrowserExecutable } from '../packages/shared/src/browser-profiles/launcher.ts'

// Browser paths for discovery
const BROWSER_PATHS: Record<
  string,
  Array<{ path: string; name: string; type: string }>
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
    { path: '/usr/bin/nova-seller', name: 'Nova Seller', type: 'nova-seller' },
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

function listAvailableBrowsers(): void {
  console.log('\n📋 Available browsers:\n')

  const currentPlatform = platform()
  const browsers = BROWSER_PATHS[currentPlatform] || []
  let found = 0

  for (const browser of browsers) {
    if (existsSync(browser.path)) {
      console.log(`  ✅ ${browser.name} (${browser.type})`)
      console.log(`     Path: ${browser.path}\n`)
      found++
    }
  }

  if (found === 0) {
    console.log('  ❌ No supported browsers found.\n')
    console.log('  Please install one of:')
    console.log('    - Nova Seller (recommended)')
    console.log('    - BrowserOS')
    console.log('    - Google Chrome')
    console.log('    - Chromium\n')
  }
}

function showCurrentConfig(): void {
  const config = getBrowserConfig()
  const configPath = getConfigFilePath()
  const defaultBrowser = findBrowserExecutable()

  console.log('\n⚙️  Current browser configuration:\n')
  console.log(`  Config file: ${configPath}`)

  if (config.customBrowserPath) {
    console.log(`  Custom path: ${config.customBrowserPath}`)
    console.log(`  Use custom only: ${config.useCustomPathOnly ? 'Yes' : 'No'}`)
    if (config.browserType) {
      console.log(`  Browser type: ${config.browserType}`)
    }

    // Check if path is valid
    if (existsSync(config.customBrowserPath)) {
      console.log(`  Status: ✅ Valid`)
    } else {
      console.log(`  Status: ❌ Path not found!`)
    }
  } else {
    console.log('  Custom path: Not set (using auto-detection)')
  }

  console.log(`\n  Active browser: ${defaultBrowser || 'None found'}\n`)
}

function setBrowser(
  browserPath: string,
  options?: { type?: string; exclusive?: boolean },
): void {
  // Validate path
  if (!existsSync(browserPath)) {
    console.error(`\n❌ Error: Browser not found at: ${browserPath}\n`)
    process.exit(1)
  }

  try {
    setBrowserPath(browserPath, {
      browserType: options?.type as any,
      useCustomPathOnly: options?.exclusive,
    })

    console.log(`\n✅ Browser path configured successfully!`)
    console.log(`   Path: ${browserPath}`)
    if (options?.type) {
      console.log(`   Type: ${options.type}`)
    }
    if (options?.exclusive) {
      console.log(`   Mode: Exclusive (won't fallback to other browsers)`)
    }
    console.log('')
  } catch (err) {
    console.error(`\n❌ Error: ${err instanceof Error ? err.message : err}\n`)
    process.exit(1)
  }
}

function clearBrowser(): void {
  clearCustomBrowserPath()
  console.log('\n✅ Custom browser path cleared. Using auto-detection.\n')
}

function printUsage(): void {
  console.log(`
Browser Configuration Tool

Usage:
  configure-browser.ts <command> [options]

Commands:
  list                      List all available browsers
  show                      Show current configuration
  set <path> [--type TYPE]  Set custom browser path
  clear                     Clear custom path (use auto-detection)

Options for 'set':
  --type <type>       Browser type: nova-seller, browseros, chrome, chromium
  --exclusive         Only use this path, don't fallback to others

Examples:
  # List available browsers
  npx ts-node scripts/configure-browser.ts list

  # Set custom browser path
  npx ts-node scripts/configure-browser.ts set /Applications/BrowserOS.app/Contents/MacOS/BrowserOS

  # Set with type hint
  npx ts-node scripts/configure-browser.ts set /path/to/browser --type browseros

  # Clear custom path
  npx ts-node scripts/configure-browser.ts clear
`)
}

// Main
const args = process.argv.slice(2)
const command = args[0]

switch (command) {
  case 'list':
    listAvailableBrowsers()
    break

  case 'show':
    showCurrentConfig()
    break

  case 'set': {
    if (!args[1]) {
      console.error('\n❌ Error: Please provide browser path\n')
      printUsage()
      process.exit(1)
    }

    const setOptions: { type?: string; exclusive?: boolean } = {}
    for (let i = 2; i < args.length; i++) {
      if (args[i] === '--type' && args[i + 1]) {
        setOptions.type = args[++i]
      } else if (args[i] === '--exclusive') {
        setOptions.exclusive = true
      }
    }

    setBrowser(args[1], setOptions)
    break
  }

  case 'clear':
    clearBrowser()
    break

  default:
    printUsage()
    break
}
