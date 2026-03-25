/**
 * Browser Agent IPC Handlers
 *
 * Connects the BrowserAgent (pi-mono) to the Electron renderer via IPC.
 * Handles streaming chat responses using webContents.send for events.
 */

import { ipcMain, type WebContents } from 'electron'
import { BrowserAgent, type BrowserAgentEvent } from '@craft-agent/shared/agent'
import { listModels } from '@craft-agent/shared/agent/pi-ai-adapter'
import { IPC_CHANNELS } from '../shared/types'

let agent: BrowserAgent | null = null

function getAgent(): BrowserAgent {
  if (!agent) {
    agent = new BrowserAgent()
  }
  return agent
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
  ipcMain.handle(IPC_CHANNELS.AGENT_LIST_MODELS, async (_event, provider?: string) => {
    return listModels(provider)
  })

  // Chat — streams events back to renderer via webContents.send
  ipcMain.handle(
    IPC_CHANNELS.AGENT_CHAT,
    async (event, message: string, options?: { apiKey?: string }) => {
      const a = getAgent()
      const sender = event.sender as WebContents

      // If no model is set, try to set a default
      if (!a.getModel()) {
        try {
          // Try Claude Sonnet first, fall back to others
          const models = listModels()
          const anthropic = models.find(
            (m) => m.provider === 'anthropic' && m.id.includes('sonnet'),
          )
          if (anthropic) {
            a.setModel('anthropic', anthropic.id)
          } else if (models.length > 0) {
            a.setModel(models[0].provider, models[0].id)
          } else {
            sender.send(IPC_CHANNELS.AGENT_EVENT, {
              type: 'error',
              error: 'No models available. Please set an API key in Settings.',
            } satisfies BrowserAgentEvent)
            return
          }
        } catch {
          sender.send(IPC_CHANNELS.AGENT_EVENT, {
            type: 'error',
            error: 'Failed to initialize model. Check your API key.',
          } satisfies BrowserAgentEvent)
          return
        }
      }

      try {
        for await (const agentEvent of a.chat(message, options)) {
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
