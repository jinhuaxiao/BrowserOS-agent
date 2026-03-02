/**
 * Regenerate fingerprint for an existing profile.
 * Usage: bun packages/craft-agents/scripts/regen-profile.ts <profileId>
 */

import { writeBrowserOSConfig } from '../packages/shared/src/browser-profiles/browseros-config.ts'
import { regenerateFingerprint } from '../packages/shared/src/browser-profiles/index.ts'

const profileId = process.argv[2]
if (!profileId) {
  console.error(
    'Usage: bun packages/craft-agents/scripts/regen-profile.ts <profileId>',
  )
  process.exit(1)
}

async function main() {
  console.log(`Regenerating fingerprint for profile: ${profileId}`)
  const profile = await regenerateFingerprint(profileId)
  if (!profile) {
    console.error('Profile not found')
    process.exit(1)
  }
  console.log(`Done! New UA: ${profile.fingerprint.navigator.userAgent}`)
  console.log(`WebGL vendor: ${profile.fingerprint.webgl.vendor}`)
  console.log(`WebGL renderer: ${profile.fingerprint.webgl.renderer}`)
  console.log(
    `WebGL unmaskedVendor: ${profile.fingerprint.webgl.unmaskedVendor}`,
  )
  console.log(
    `WebGL unmaskedRenderer: ${profile.fingerprint.webgl.unmaskedRenderer}`,
  )
  console.log(
    `Fonts (${profile.fingerprint.fonts.enabledFonts.length}): ${profile.fingerprint.fonts.enabledFonts.slice(0, 5).join(', ')}...`,
  )

  // Also regenerate the BrowserOS kernel config
  const configPath = writeBrowserOSConfig(profileId, profile.fingerprint, {
    profileName: profile.name,
  })
  console.log(`Kernel config updated: ${configPath}`)
}

main().catch(console.error)
