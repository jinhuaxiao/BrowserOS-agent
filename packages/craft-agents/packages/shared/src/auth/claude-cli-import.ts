/**
 * Claude CLI Credential Import
 *
 * Reads Claude Code CLI OAuth credentials from the macOS Keychain.
 * The CLI stores credentials under the service name "Claude Code-credentials".
 */
import { execSync } from 'node:child_process'
import { debug } from '../utils/debug.ts'

export interface CliCredentials {
  accessToken: string
  refreshToken?: string
  expiresAt?: number
}

/**
 * Attempt to read Claude Code CLI OAuth credentials from macOS Keychain.
 * Returns null if not found, not on macOS, or if parsing fails.
 */
export function getClaudeCliCredentials(): CliCredentials | null {
  if (process.platform !== 'darwin') {
    debug('[cli-import] Not on macOS, skipping keychain read')
    return null
  }

  try {
    const raw = execSync(
      'security find-generic-password -s "Claude Code-credentials" -w',
      { encoding: 'utf-8', timeout: 5000, stdio: ['pipe', 'pipe', 'pipe'] },
    ).trim()

    if (!raw) {
      debug('[cli-import] Keychain returned empty value')
      return null
    }

    const data = JSON.parse(raw)

    // The CLI stores OAuth credentials under claudeAiOauth
    const oauth = data?.claudeAiOauth
    if (!oauth?.accessToken) {
      debug('[cli-import] No claudeAiOauth.accessToken found in keychain data')
      return null
    }

    debug('[cli-import] Successfully read CLI credentials from keychain')
    return {
      accessToken: oauth.accessToken,
      refreshToken: oauth.refreshToken,
      expiresAt: oauth.expiresAt,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    debug('[cli-import] Failed to read keychain:', message)
    return null
  }
}
