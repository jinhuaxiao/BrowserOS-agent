#!/usr/bin/env bun
/**
 * Script to rebuild fingerprint extensions for all browser profiles
 *
 * This updates all profiles to use the latest inject.js code with:
 * - Fixed Intl API locale override
 * - Improved function spoofing
 * - Removed Canvas noise injection
 * - Removed debug logs
 *
 * Usage: bun run scripts/rebuild-fingerprint-extensions.ts
 */

import { rebuildAllProfileExtensions, listProfiles } from '../packages/shared/src/browser-profiles/storage.ts';

async function main() {
  console.log('=== Fingerprint Extension Rebuild Tool ===\n');

  // List profiles first
  const profiles = listProfiles();
  console.log(`Found ${profiles.length} browser profile(s):\n`);

  for (const profile of profiles) {
    console.log(`  - ${profile.name} (${profile.id})`);
    console.log(`    Platform: ${profile.fingerprint.navigator.platform}`);
    console.log(`    Language: ${profile.fingerprint.navigator.language}`);
    console.log(`    Languages: ${profile.fingerprint.navigator.languages.join(', ')}`);
    console.log('');
  }

  if (profiles.length === 0) {
    console.log('No profiles found. Nothing to rebuild.');
    return;
  }

  console.log('Rebuilding fingerprint extensions...\n');

  const result = await rebuildAllProfileExtensions();

  console.log('=== Rebuild Complete ===\n');
  console.log(`  Success: ${result.success}`);
  console.log(`  Failed:  ${result.failed}`);

  if (result.errors.length > 0) {
    console.log('\nErrors:');
    for (const error of result.errors) {
      console.log(`  - ${error.profileId}: ${error.error}`);
    }
  }

  console.log('\nThe fingerprint extensions have been rebuilt with:');
  console.log('  - Fixed Intl API locale override (matches navigator.language)');
  console.log('  - Improved function spoofing (toString returns native code)');
  console.log('  - Removed Canvas noise injection (was causing tampering detection)');
  console.log('  - Removed debug console.log statements');
  console.log('\nRestart your browser profiles for changes to take effect.');
}

main().catch(console.error);
