/**
 * Claude Code Auth Detection
 *
 * Automatically detects Claude Code CLI's OAuth token from the system keychain.
 * This allows BrowserAgent to use the same authentication as Claude Code
 * without requiring users to configure a separate API key.
 *
 * Supported platforms:
 * - macOS: reads from Keychain via `security` command
 * - Linux: reads from libsecret via `secret-tool`
 * - Windows: reads from Windows Credential Manager via `cmdkey` (future)
 */

import { execSync } from 'node:child_process'
import { platform } from 'node:os'
import { existsSync } from 'node:fs'

interface ClaudeCodeCredentials {
  accessToken: string
  refreshToken?: string
  expiresAt?: number
  subscriptionType?: string
}

/**
 * Try to read Claude Code OAuth credentials from the system keychain
 */
export function getClaudeCodeCredentials(): ClaudeCodeCredentials | null {
  const os = platform()

  try {
    if (os === 'darwin') {
      return readFromMacKeychain()
    }
    if (os === 'linux') {
      return readFromLinuxKeyring()
    }
    // Windows support can be added later
  } catch {
    // Keychain access failed — not installed or not authorized
  }

  return null
}

/**
 * Check if Claude Code CLI is installed and authenticated
 */
export function isClaudeCodeAvailable(): boolean {
  try {
    const which = execSync('which claude', { encoding: 'utf-8', timeout: 3000 }).trim()
    return Boolean(which)
  } catch {
    return false
  }
}

/**
 * Get the API key to use for Anthropic API calls.
 * Priority:
 * 1. ANTHROPIC_API_KEY env var (explicit user config)
 * 2. Claude Code OAuth token (auto-detected)
 */
export function resolveApiKey(): string | null {
  // 1. Explicit env var
  const envKey = process.env.ANTHROPIC_API_KEY
  if (envKey) return envKey

  // 2. Claude Code OAuth token
  const creds = getClaudeCodeCredentials()
  if (creds?.accessToken) {
    // Check if token might be expired
    if (creds.expiresAt && creds.expiresAt < Date.now()) {
      // Token expired — user needs to re-auth claude CLI
      return null
    }
    return creds.accessToken
  }

  return null
}

// -- Platform-specific implementations --

function readFromMacKeychain(): ClaudeCodeCredentials | null {
  try {
    const raw = execSync(
      'security find-generic-password -s "Claude Code-credentials" -w',
      { encoding: 'utf-8', timeout: 5000 },
    ).trim()

    if (!raw) return null

    const data = JSON.parse(raw)
    const oauth = data?.claudeAiOauth
    if (!oauth?.accessToken) return null

    return {
      accessToken: oauth.accessToken,
      refreshToken: oauth.refreshToken,
      expiresAt: oauth.expiresAt,
      subscriptionType: oauth.subscriptionType,
    }
  } catch {
    return null
  }
}

function readFromLinuxKeyring(): ClaudeCodeCredentials | null {
  try {
    const raw = execSync(
      'secret-tool lookup service "Claude Code-credentials"',
      { encoding: 'utf-8', timeout: 5000 },
    ).trim()

    if (!raw) return null

    const data = JSON.parse(raw)
    const oauth = data?.claudeAiOauth
    if (!oauth?.accessToken) return null

    return {
      accessToken: oauth.accessToken,
      refreshToken: oauth.refreshToken,
      expiresAt: oauth.expiresAt,
      subscriptionType: oauth.subscriptionType,
    }
  } catch {
    return null
  }
}
