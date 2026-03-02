/**
 * Quick script to create a new profile and launch BrowserOS for testing.
 *
 * Usage: bun packages/craft-agents/scripts/create-and-launch.ts
 */
import {
  createProfile,
  findBrowserExecutable,
  launchBrowser,
} from '../packages/shared/src/browser-profiles/index.ts'

async function main() {
  console.log('Creating new browser profile...')

  const profile = await createProfile({
    name: 'fingerprint-test',
    targetPlatform: 'macos',
    targetRegion: 'us',
    startupUrl: 'https://www.browserscan.net/',
  })

  console.log(`Profile created: ${profile.id}`)
  console.log(`User data dir: ${profile.userDataDir}`)
  console.log(
    `Chrome version in UA: ${profile.fingerprint.navigator.userAgent}`,
  )
  console.log(`WebGL renderer: ${profile.fingerprint.webgl?.unmaskedRenderer}`)

  const browserPath = findBrowserExecutable()
  console.log(`Browser path: ${browserPath}`)

  console.log('\nLaunching browser...')
  const result = await launchBrowser(profile, {
    startupUrl: 'https://www.browserscan.net/',
  })

  if (result.success) {
    console.log(`Browser launched! PID: ${result.pid}`)
    console.log(`Profile ID: ${profile.id}`)
  } else {
    console.error(`Launch failed: ${result.error}`)
  }
}

main().catch(console.error)
