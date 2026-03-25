/**
 * pi-ai Adapter
 *
 * Unified multi-model LLM adapter using @mariozechner/pi-ai.
 * Provides a provider-agnostic streaming interface that can replace
 * the Claude Agent SDK's query() function.
 *
 * Supported providers: Anthropic, OpenAI, Google, Bedrock, Mistral,
 * xAI, Groq, Cerebras, OpenRouter, and more.
 */

import type {
  Api,
  AssistantMessageEventStream,
  Model,
  AssistantMessage as PiAssistantMessage,
  Context as PiContext,
  Tool as PiTool,
  ToolCall as PiToolCall,
  Usage as PiUsage,
  UserMessage as PiUserMessage,
  SimpleStreamOptions,
  TextContent,
  ThinkingContent,
  ToolResultMessage,
} from '@mariozechner/pi-ai'
import {
  completeSimple,
  getModel,
  getModels,
  getProviders,
  streamSimple,
} from '@mariozechner/pi-ai'

// Re-export pi-ai types for consumers
export type {
  PiAssistantMessage,
  PiContext,
  PiToolCall,
  PiTool,
  PiUserMessage,
  PiUsage,
  Model,
  SimpleStreamOptions,
  AssistantMessageEventStream,
  TextContent,
  ThinkingContent,
  ToolResultMessage,
}

/**
 * Provider configuration for connecting to an LLM
 */
export interface ProviderConfig {
  provider: string
  modelId: string
  apiKey?: string
  baseUrl?: string
}

/**
 * Resolve a provider+model string to a pi-ai Model object.
 * Format: "provider:model-id" (e.g., "anthropic:claude-sonnet-4-20250514")
 */
export function resolveModel(modelSpec: string): Model<Api> | null {
  const [provider, ...modelParts] = modelSpec.split(':')
  const modelId = modelParts.join(':')

  if (!provider || !modelId) return null

  try {
    const model = getModel(provider as any, modelId as any)
    return model || null
  } catch {
    return null
  }
}

/**
 * List all available models for a provider
 */
export function listModels(
  provider?: string,
): Array<{ provider: string; id: string; name: string }> {
  const providers = provider ? [provider] : getProviders()
  const results: Array<{ provider: string; id: string; name: string }> = []

  for (const p of providers) {
    try {
      const models = getModels(p as any)
      for (const m of models) {
        results.push({
          provider: m.provider,
          id: m.id,
          name: m.name || m.id,
        })
      }
    } catch {
      // Provider not registered
    }
  }

  return results
}

/**
 * Stream a chat completion using pi-ai's unified API.
 * This is the core function that replaces Claude SDK's query().
 */
export function streamChat(
  model: Model<Api>,
  context: PiContext,
  options?: SimpleStreamOptions,
): AssistantMessageEventStream {
  return streamSimple(model, context, options)
}

/**
 * Non-streaming chat completion
 */
export async function completeChat(
  model: Model<Api>,
  context: PiContext,
  options?: SimpleStreamOptions,
): Promise<PiAssistantMessage> {
  return completeSimple(model, context, options)
}

/**
 * Create a pi-ai Tool from a simple definition.
 * This replaces Claude SDK's tool() function.
 */
export function createTool(
  name: string,
  description: string,
  inputSchema: Record<string, unknown>,
): PiTool {
  return {
    name,
    description,
    inputSchema: inputSchema as any,
  }
}

/**
 * Build a pi-ai Context from messages and tools
 */
export function buildContext(
  systemPrompt: string,
  messages: Array<PiUserMessage | PiAssistantMessage | ToolResultMessage>,
  tools?: PiTool[],
): PiContext {
  return {
    systemPrompt,
    messages,
    tools,
  }
}

/**
 * Create a tool result message for the conversation
 */
export function createToolResult(
  toolCallId: string,
  content: string | Array<TextContent>,
  isError = false,
): ToolResultMessage {
  const resultContent: Array<TextContent> =
    typeof content === 'string' ? [{ type: 'text', text: content }] : content

  return {
    role: 'toolResult',
    id: toolCallId,
    content: resultContent,
    isError,
    timestamp: Date.now(),
  }
}
