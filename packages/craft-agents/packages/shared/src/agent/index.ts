/**
 * Agent Module
 *
 * Browser-focused AI agent built on pi-mono for multi-model support.
 */

// BrowserAgent — the main agent class
export { BrowserAgent, type BrowserAgentEvent } from './browser-agent.ts'

// Browser tools — local profile/proxy management tools
export { BROWSER_TOOLS, executeBrowserTool } from './browser-tools.ts'

// MCP Bridge — connects to BrowserOS MCP servers
export { McpBridge, type McpServerConfig } from './mcp-bridge.ts'

// pi-ai adapter — unified multi-model LLM API
export {
  buildContext,
  completeChat,
  createTool,
  createToolResult,
  listModels,
  resolveModel,
  streamChat,
  type ProviderConfig,
} from './pi-ai-adapter.ts'

// Re-export pi-ai types
export type {
  AssistantMessageEventStream,
  Model,
  PiAssistantMessage,
  PiContext,
  PiTool,
  PiToolCall,
  PiUsage,
  PiUserMessage,
  SimpleStreamOptions,
  TextContent,
  ThinkingContent,
  ToolResultMessage,
} from './pi-ai-adapter.ts'
