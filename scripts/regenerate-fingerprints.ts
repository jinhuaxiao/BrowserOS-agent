#!/usr/bin/env bun
/**
 * Script to regenerate fingerprints for all browser profiles
 *
 * This regenerates fingerprints with:
 * - Real Chrome version numbers (not BrowserOS versions)
 * - Updated inject.js with Intl API locale fix
 *
 * Usage: bun run scripts/regenerate-fingerprints.ts
 */

import { regenerateFingerprint, listProfiles } from '../packages/shared/src/browser-profiles/storage.ts';

async function main() {
  console.log('=== Fingerprint Regeneration Tool ===\n');

  // List profiles first
  const profiles = listProfiles();
  console.log(`Found ${profiles.length} browser profile(s):\n`);

  for (const profile of profiles) {
    console.log(`  - ${profile.name} (${profile.id})`);
    console.log(`    Current UA: ${profile.fingerprint.navigator.userAgent.substring(0, 80)}...`);
  }

  if (profiles.length === 0) {
    console.log('No profiles found. Nothing to regenerate.');
    return;
  }

  console.log('\nRegenerating fingerprints with real Chrome versions...\n');

  let success = 0;
  let failed = 0;

  for (const profile of profiles) {
    try {
      // Extract target platform from current fingerprint
      const platform = profile.fingerprint.navigator.platform;
      let targetPlatform: 'windows' | 'macos' | 'linux' = 'windows';
      if (platform === 'MacIntel') targetPlatform = 'macos';
      else if (platform === 'Linux x86_64') targetPlatform = 'linux';

      const updated = await regenerateFingerprint(profile.id, { targetPlatform });
      if (updated) {
        console.log(`  ✓ ${profile.name}`);
        console.log(`    New UA: ${updated.fingerprint.navigator.userAgent.substring(0, 80)}...`);
        success++;
      } else {
        console.log(`  ✗ ${profile.name} - Failed to regenerate`);
        failed++;
      }
    } catch (err) {
      console.log(`  ✗ ${profile.name} - Error: ${err}`);
      failed++;
    }
  }

  console.log('\n=== Regeneration Complete ===\n');
  console.log(`  Success: ${success}`);
  console.log(`  Failed:  ${failed}`);

  console.log('\nChanges made:');
  console.log('  - User Agent now uses real Chrome version numbers');
  console.log('  - Fingerprint extension rebuilt with Intl API locale fix');
  console.log('\nRestart your browser profiles for changes to take effect.');
}

main().catch(console.error);
