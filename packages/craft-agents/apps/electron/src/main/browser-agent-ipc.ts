/**
 * Browser Agent IPC Handlers
 *
 * Connects the BrowserAgent (pi-mono) to the Electron renderer via IPC.
 * Auto-detects Claude Code CLI's OAuth token for zero-config setup.
 */

import { ipcMain, type WebContents } from 'electron'
import { BrowserAgent, type BrowserAgentEvent } from '@craft-agent/shared/agent'
import { listModels } from '@craft-agent/shared/agent/pi-ai-adapter'
import {
  resolveApiKey,
  isClaudeCodeAvailable,
  getClaudeCodeCredentials,
} from '@craft-agent/shared/agent/claude-code-auth'
import { IPC_CHANNELS } from '../shared/types'

let agent: BrowserAgent | null = null
let resolvedApiKey: string | null = null

function getAgent(): BrowserAgent {
  if (!agent) {
    agent = new BrowserAgent()
  }
  return agent
}

/**
 * Initialize: detect API key and set default model
 */
function ensureInitialized(sender: WebContents): boolean {
  const a = getAgent()

  // Resolve API key if not done yet
  if (!resolvedApiKey) {
    resolvedApiKey = resolveApiKey()
    if (resolvedApiKey) {
      const creds = getClaudeCodeCredentials()
      const source = process.env.ANTHROPIC_API_KEY
        ? 'ANTHROPIC_API_KEY env var'
        : `Claude Code CLI (${creds?.subscriptionType || 'oauth'})`
      console.log(`[BrowserAgent] API key resolved from: ${source}`)
    }
  }

  if (!resolvedApiKey) {
    sender.send(IPC_CHANNELS.AGENT_EVENT, {
      type: 'error',
      error: isClaudeCodeAvailable()
        ? 'Claude Code CLI detected but OAuth token expired. Run `claude auth login` to re-authenticate.'
        : 'No API key found. Install Claude Code CLI (`claude auth login`) or set ANTHROPIC_API_KEY environment variable.',
    } satisfies BrowserAgentEvent)
    return false
  }

  // Auto-set model — use Opus 4.6 (CLI mode uses Claude Code subscription, not per-token billing)
  if (!a.getModel()) {
    try {
      const preferred = ['claude-opus-4-6', 'claude-opus-4-5', 'claude-sonnet-4-6']
      const models = listModels('anthropic')
      const best = models.find((m) => preferred.includes(m.id))
      if (best) {
        a.setModel('anthropic', best.id)
      } else {
        a.setModel('anthropic', 'claude-opus-4-6')
      }
      console.log(`[BrowserAgent] Using model: ${a.getModel()?.id}`)
    } catch (err) {
      sender.send(IPC_CHANNELS.AGENT_EVENT, {
        type: 'error',
        error: `Failed to initialize model: ${err instanceof Error ? err.message : String(err)}`,
      } satisfies BrowserAgentEvent)
      return false
    }
  }

  return true
}

export function registerBrowserAgentHandlers(): void {
  // Set model
  ipcMain.handle(
    IPC_CHANNELS.AGENT_SET_MODEL,
    async (_event, provider: string, modelId: string) => {
      try {
        getAgent().setModel(provider, modelId)
        return { success: true }
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : String(err),
        }
      }
    },
  )

  // List available models
  ipcMain.handle(
    IPC_CHANNELS.AGENT_LIST_MODELS,
    async (_event, provider?: string) => {
      return listModels(provider)
    },
  )

  // Get auth status
  ipcMain.handle('agent:authStatus', async () => {
    const apiKey = resolveApiKey()
    const claudeInstalled = isClaudeCodeAvailable()
    const creds = getClaudeCodeCredentials()
    return {
      hasApiKey: Boolean(apiKey),
      claudeCodeInstalled: claudeInstalled,
      authSource: process.env.ANTHROPIC_API_KEY
        ? 'env'
        : creds?.accessToken
          ? 'claude-code'
          : 'none',
      subscriptionType: creds?.subscriptionType,
    }
  })

  // Chat — streams events back to renderer
  ipcMain.handle(
    IPC_CHANNELS.AGENT_CHAT,
    async (event, message: string, options?: { apiKey?: string }) => {
      const sender = event.sender as WebContents

      if (!ensureInitialized(sender)) return

      const chatOptions = {
        apiKey: options?.apiKey || resolvedApiKey || undefined,
      }

      try {
        for await (const agentEvent of getAgent().chat(message, chatOptions)) {
          sender.send(IPC_CHANNELS.AGENT_EVENT, agentEvent)
        }
      } catch (err) {
        sender.send(IPC_CHANNELS.AGENT_EVENT, {
          type: 'error',
          error: err instanceof Error ? err.message : String(err),
        } satisfies BrowserAgentEvent)
      }
    },
  )

  // Stop current chat
  ipcMain.handle(IPC_CHANNELS.AGENT_STOP, async () => {
    getAgent().stop()
  })

  // Clear history
  ipcMain.handle(IPC_CHANNELS.AGENT_CLEAR, async () => {
    getAgent().clearHistory()
  })
}
