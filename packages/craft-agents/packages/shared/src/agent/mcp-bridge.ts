/**
 * MCP Bridge for pi-ai
 *
 * Bridges MCP (Model Context Protocol) servers to pi-ai's Tool interface.
 * Converts MCP tool definitions to pi-ai Tools and handles tool execution
 * through MCP server connections.
 *
 * This replaces the Claude SDK's built-in createSdkMcpServer() integration.
 */

import type { Tool as PiTool, TextContent } from '@mariozechner/pi-ai'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { createToolResult } from './pi-ai-adapter.ts'

/**
 * MCP server connection configuration
 */
export interface McpServerConfig {
  name: string
  type: 'http' | 'sse' | 'stdio'
  url?: string
  command?: string
  args?: string[]
  env?: Record<string, string>
}

/**
 * Connected MCP server with its tools
 */
interface ConnectedServer {
  name: string
  client: Client
  tools: PiTool[]
}

/**
 * MCP Bridge - manages MCP server connections and tool bridging
 */
export class McpBridge {
  private servers = new Map<string, ConnectedServer>()

  /**
   * Connect to an MCP server and discover its tools
   */
  async connect(config: McpServerConfig): Promise<PiTool[]> {
    const client = new Client(
      {
        name: 'craft-agent',
        version: '1.0.0',
      },
      {
        capabilities: {},
      },
    )

    let transport
    if (config.type === 'sse' && config.url) {
      transport = new SSEClientTransport(new URL(config.url))
    } else if (config.type === 'http' && config.url) {
      // HTTP transport uses SSE underneath for MCP
      transport = new SSEClientTransport(new URL(config.url))
    } else if (config.type === 'stdio' && config.command) {
      transport = new StdioClientTransport({
        command: config.command,
        args: config.args,
        env: config.env,
      })
    } else {
      throw new Error(`Invalid MCP server config: ${config.name}`)
    }

    await client.connect(transport)

    // Discover tools
    const toolsResult = await client.listTools()
    const piTools: PiTool[] = toolsResult.tools.map((mcpTool) => ({
      name: `${config.name}__${mcpTool.name}`,
      description: mcpTool.description || '',
      inputSchema: (mcpTool.inputSchema || {
        type: 'object',
        properties: {},
      }) as any,
    }))

    this.servers.set(config.name, {
      name: config.name,
      client,
      tools: piTools,
    })

    return piTools
  }

  /**
   * Get all tools from all connected servers
   */
  getAllTools(): PiTool[] {
    const tools: PiTool[] = []
    for (const server of this.servers.values()) {
      tools.push(...server.tools)
    }
    return tools
  }

  /**
   * Execute a tool call through the appropriate MCP server.
   * Tool names are prefixed with server name: "serverName__toolName"
   */
  async executeTool(
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<{ content: TextContent[]; isError: boolean }> {
    const [serverName, ...toolParts] = toolName.split('__')
    const actualToolName = toolParts.join('__')

    if (!serverName || !actualToolName) {
      return {
        content: [
          { type: 'text', text: `Invalid tool name format: ${toolName}` },
        ],
        isError: true,
      }
    }

    const server = this.servers.get(serverName)
    if (!server) {
      return {
        content: [
          { type: 'text', text: `MCP server not found: ${serverName}` },
        ],
        isError: true,
      }
    }

    try {
      const result = await server.client.callTool({
        name: actualToolName,
        arguments: args,
      })

      const content: TextContent[] = (result.content as any[])?.map(
        (c: any) => {
          if (c.type === 'text') return { type: 'text' as const, text: c.text }
          return { type: 'text' as const, text: JSON.stringify(c) }
        },
      ) || [{ type: 'text', text: 'No content returned' }]

      return {
        content,
        isError: result.isError ?? false,
      }
    } catch (err) {
      return {
        content: [
          {
            type: 'text',
            text: `Tool execution error: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
        isError: true,
      }
    }
  }

  /**
   * Check if a tool belongs to an MCP server
   */
  isMcpTool(toolName: string): boolean {
    const [serverName] = toolName.split('__')
    return serverName ? this.servers.has(serverName) : false
  }

  /**
   * Disconnect from all MCP servers
   */
  async disconnectAll(): Promise<void> {
    for (const server of this.servers.values()) {
      try {
        await server.client.close()
      } catch {
        // Best effort
      }
    }
    this.servers.clear()
  }

  /**
   * Disconnect from a specific server
   */
  async disconnect(serverName: string): Promise<void> {
    const server = this.servers.get(serverName)
    if (server) {
      try {
        await server.client.close()
      } catch {
        // Best effort
      }
      this.servers.delete(serverName)
    }
  }
}
