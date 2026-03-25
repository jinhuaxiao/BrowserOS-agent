/**
 * BrowserAgent
 *
 * AI-powered browser profile management agent built on pi-mono.
 * Supports multiple LLM providers (Anthropic, OpenAI, Google, etc.)
 * and integrates with BrowserOS MCP servers for browser automation.
 */

import { getModel } from '@mariozechner/pi-ai'
import type {
  Api,
  AssistantMessage as PiAssistantMessage,
  AssistantMessageEvent,
  Model,
  ToolCall as PiToolCall,
  ToolResultMessage,
  UserMessage as PiUserMessage,
} from '@mariozechner/pi-ai'
import { streamChat, buildContext, createToolResult } from './pi-ai-adapter.ts'
import { McpBridge, type McpServerConfig } from './mcp-bridge.ts'
import { BROWSER_TOOLS, executeBrowserTool } from './browser-tools.ts'

const SYSTEM_PROMPT = `You are a browser profile management assistant. You help users manage browser profiles for multi-account operations.

Your capabilities:
- Create, launch, and stop browser profiles
- Manage proxy pools (list, health check, import)
- Regenerate fingerprints for anti-detection
- Control running browsers via MCP tools (navigate, click, screenshot, etc.)

Be concise and action-oriented. When the user asks to do something, use the available tools to do it directly.
When listing profiles or proxies, format the output in a readable table.`

/**
 * Event types emitted during chat
 */
export type BrowserAgentEvent =
  | { type: 'text_delta'; text: string }
  | { type: 'thinking_delta'; text: string }
  | { type: 'tool_call'; name: string; args: Record<string, unknown> }
  | { type: 'tool_result'; name: string; result: string; isError: boolean }
  | { type: 'complete'; message: PiAssistantMessage }
  | { type: 'error'; error: string }

export class BrowserAgent {
  private model: Model<Api> | null = null
  private mcpBridge = new McpBridge()
  private abortController: AbortController | null = null
  private messages: Array<PiUserMessage | PiAssistantMessage | ToolResultMessage> = []

  setModel(provider: string, modelId: string): void {
    this.model = getModel(provider as any, modelId as any)
    if (!this.model) {
      throw new Error(`Model not found: ${provider}/${modelId}`)
    }
  }

  getModel(): Model<Api> | null {
    return this.model
  }

  async connectMcp(config: McpServerConfig): Promise<string[]> {
    const tools = await this.mcpBridge.connect(config)
    return tools.map((t) => t.name)
  }

  async disconnectMcp(): Promise<void> {
    await this.mcpBridge.disconnectAll()
  }

  clearHistory(): void {
    this.messages = []
  }

  getHistory() {
    return [...this.messages]
  }

  /**
   * Main chat loop — sends a message, handles tool calls, yields events
   */
  async *chat(
    userMessage: string,
    options?: { apiKey?: string },
  ): AsyncGenerator<BrowserAgentEvent> {
    if (!this.model) {
      yield { type: 'error', error: 'No model configured. Call setModel() first.' }
      return
    }

    this.abortController = new AbortController()

    const userMsg: PiUserMessage = {
      role: 'user',
      content: userMessage,
      timestamp: Date.now(),
    }
    this.messages.push(userMsg)

    // Agent loop: keep going until model stops calling tools
    let continueLoop = true
    while (continueLoop) {
      continueLoop = false

      const allTools = [...BROWSER_TOOLS, ...this.mcpBridge.getAllTools()]
      const context = buildContext(SYSTEM_PROMPT, this.messages, allTools)

      const stream = streamChat(this.model, context, {
        signal: this.abortController.signal,
        apiKey: options?.apiKey,
      })

      let assistantMessage: PiAssistantMessage | null = null

      try {
        // pi-ai event protocol:
        // text_delta: { type: "text_delta", delta: string, contentIndex, partial }
        // thinking_delta: { type: "thinking_delta", delta: string, contentIndex, partial }
        // toolcall_end: { type: "toolcall_end", toolCall, contentIndex, partial }
        // done: { type: "done", reason, message }
        // error: { type: "error", reason, error (AssistantMessage) }
        for await (const event of stream) {
          const e = event as AssistantMessageEvent

          if (e.type === 'text_delta') {
            yield { type: 'text_delta', text: e.delta }
          } else if (e.type === 'thinking_delta') {
            yield { type: 'thinking_delta', text: e.delta }
          } else if (e.type === 'done') {
            assistantMessage = e.message
          } else if (e.type === 'error') {
            const errMsg = e.error as PiAssistantMessage
            yield {
              type: 'error',
              error: errMsg.errorMessage || 'Unknown model error',
            }
            return
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          yield { type: 'error', error: 'Aborted' }
          return
        }
        yield { type: 'error', error: err instanceof Error ? err.message : String(err) }
        return
      }

      if (!assistantMessage) {
        yield { type: 'error', error: 'No response from model' }
        return
      }

      this.messages.push(assistantMessage)

      // Process tool calls
      const toolCalls = assistantMessage.content.filter(
        (c): c is PiToolCall => c.type === 'toolCall',
      )

      if (toolCalls.length > 0) {
        continueLoop = true

        for (const tc of toolCalls) {
          yield { type: 'tool_call', name: tc.name, args: tc.arguments }

          let resultText: string
          let isError: boolean

          if (this.mcpBridge.isMcpTool(tc.name)) {
            const mcpResult = await this.mcpBridge.executeTool(tc.name, tc.arguments)
            resultText = mcpResult.content.map((c) => c.text).join('\n')
            isError = mcpResult.isError
          } else {
            const localResult = await executeBrowserTool(tc.name, tc.arguments)
            resultText = localResult.text
            isError = localResult.isError
          }

          yield { type: 'tool_result', name: tc.name, result: resultText, isError }
          this.messages.push(createToolResult(tc.id, resultText, isError))
        }
      }

      if (assistantMessage) {
        yield { type: 'complete', message: assistantMessage }
      }
    }
  }

  stop(): void {
    this.abortController?.abort()
    this.abortController = null
  }
}
