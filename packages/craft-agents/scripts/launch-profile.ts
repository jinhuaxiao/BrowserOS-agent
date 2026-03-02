/**
 * Launch an existing profile.
 * Usage: bun packages/craft-agents/scripts/launch-profile.ts <profileId> [startupUrl]
 */
import {
  getProfile,
  launchBrowser,
} from '../packages/shared/src/browser-profiles/index.ts'

const profileId = process.argv[2]
const startupUrl = process.argv[3]

if (!profileId) {
  console.error(
    'Usage: bun packages/craft-agents/scripts/launch-profile.ts <profileId> [startupUrl]',
  )
  process.exit(1)
}

async function main() {
  const profile = getProfile(profileId)
  if (!profile) {
    console.error(`Profile not found: ${profileId}`)
    process.exit(1)
  }

  console.log(`Launching profile: ${profile.name} (${profile.id})`)
  console.log(`UA: ${profile.fingerprint.navigator.userAgent}`)

  const result = await launchBrowser(profile, { startupUrl })
  if (result.success) {
    console.log(`Browser launched! PID: ${result.pid}`)
  } else {
    console.error(`Launch failed: ${result.error}`)
  }
}

main().catch(console.error)
