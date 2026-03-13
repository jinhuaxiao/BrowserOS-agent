export interface McpTool {
  name: string
  description?: string
  inputSchema?: {
    type: string
    properties?: Record<string, JsonSchemaProperty>
    required?: string[]
  }
}

export interface JsonSchemaProperty {
  type?: string
  description?: string
  enum?: string[]
  default?: unknown
  items?: JsonSchemaProperty
  properties?: Record<string, JsonSchemaProperty>
}

export interface McpResult {
  jsonrpc: string
  id: number
  result?: unknown
  error?: { code: number; message: string }
}

export class McpClient {
  private baseUrl: string
  private reqId = 0

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  async checkHealth(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/health`, {
        signal: AbortSignal.timeout(3000),
      })
      return res.ok
    } catch {
      return false
    }
  }

  async listTools(): Promise<McpTool[]> {
    const result = await this.rpc('tools/list')
    if (result.error) throw new Error(result.error.message)
    const r = result.result as { tools?: McpTool[] }
    return r?.tools ?? []
  }

  async callTool(
    name: string,
    args: Record<string, unknown>,
  ): Promise<unknown> {
    const result = await this.rpc('tools/call', { name, arguments: args })
    if (result.error) throw new Error(result.error.message)
    return result.result
  }

  private async rpc(
    method: string,
    params?: Record<string, unknown>,
  ): Promise<McpResult> {
    const res = await fetch(`${this.baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: ++this.reqId,
        method,
        params: params ?? {},
      }),
    })
    return res.json()
  }
}
