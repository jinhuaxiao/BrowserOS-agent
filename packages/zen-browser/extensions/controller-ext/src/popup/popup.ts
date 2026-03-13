import type { JsonSchemaProperty, McpTool } from './mcp-client'
import { McpClient } from './mcp-client'

let mcpClient: McpClient | null = null
let allTools: McpTool[] = []

const $ = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T

async function getConnectionInfo(): Promise<{
  httpPort: number | null
  connected: boolean
}> {
  try {
    return await (browser.runtime.sendMessage({
      type: 'getConnectionInfo',
    }) as Promise<{
      httpPort: number | null
      connected: boolean
    }>)
  } catch {
    return { httpPort: null, connected: false }
  }
}

async function getPersistedConnectionInfo(): Promise<{
  httpPort: number | null
}> {
  try {
    const result = (await browser.storage.local.get('connectionInfo')) as {
      connectionInfo?: { httpPort?: number | null }
    }
    return {
      httpPort:
        typeof result.connectionInfo?.httpPort === 'number'
          ? result.connectionInfo.httpPort
          : null,
    }
  } catch {
    return { httpPort: null }
  }
}

async function isHealthyHttpPort(port: number): Promise<boolean> {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/health`, {
      signal: AbortSignal.timeout(1500),
    })
    return response.ok
  } catch {
    return false
  }
}

async function discoverMcpPort(): Promise<number | null> {
  const checks: Promise<number | null>[] = []
  for (let port = 9100; port <= 9199; port++) {
    checks.push(
      fetch(`http://127.0.0.1:${port}/health`, {
        signal: AbortSignal.timeout(1000),
      })
        .then((r) => (r.ok ? port : null))
        .catch(() => null),
    )
  }
  const results = await Promise.all(checks)
  return results.find((p) => p !== null) ?? null
}

async function init() {
  const statusEl = $('status')
  const statusText = $('status-text')
  const statusUrl = $('status-url')

  statusText.textContent = 'Connecting...'

  // Get MCP port from background script (up to 3 attempts)
  let httpPort: number | null = null
  for (let i = 0; i < 3; i++) {
    const info = await getConnectionInfo()
    if (info.connected && info.httpPort) {
      httpPort = info.httpPort
      break
    }
    await new Promise((r) => setTimeout(r, 1000))
  }

  if (!httpPort) {
    const persisted = await getPersistedConnectionInfo()
    if (persisted.httpPort && (await isHealthyHttpPort(persisted.httpPort))) {
      httpPort = persisted.httpPort
    }
  }

  // Fallback: parallel scan port range
  if (!httpPort) {
    statusText.textContent = 'Scanning ports...'
    httpPort = await discoverMcpPort()
  }

  if (!httpPort) {
    statusEl.className = 'status disconnected'
    statusText.textContent = 'Disconnected'
    statusUrl.textContent = ''
    showError('MCP Server not found. Make sure BrowserOS is running.')
    return
  }

  const baseUrl = `http://127.0.0.1:${httpPort}`
  mcpClient = new McpClient(baseUrl)

  const healthy = await mcpClient.checkHealth()
  if (!healthy) {
    statusEl.className = 'status disconnected'
    statusText.textContent = 'Unreachable'
    statusUrl.textContent = baseUrl
    showError('MCP Server health check failed.')
    return
  }

  statusEl.className = 'status connected'
  statusText.textContent = 'Connected'
  statusUrl.textContent = baseUrl

  await loadTools()
}

function showError(msg: string) {
  const banner = $('error-banner')
  banner.textContent = msg
  banner.classList.remove('hidden')
}

async function loadTools() {
  if (!mcpClient) return

  const toolListEl = $('tool-list')
  try {
    allTools = await mcpClient.listTools()
    $('tool-count').textContent = `${allTools.length} tools`
    renderToolList(allTools)
  } catch (err) {
    toolListEl.innerHTML = `<div class="loading" style="color:#f38ba8">Failed to load tools: ${err}</div>`
  }
}

function renderToolList(tools: McpTool[]) {
  const toolListEl = $('tool-list')

  if (tools.length === 0) {
    toolListEl.innerHTML = '<div class="loading">No tools found</div>'
    return
  }

  toolListEl.innerHTML = ''
  for (const tool of tools) {
    const item = document.createElement('div')
    item.className = 'tool-item'
    item.innerHTML = `
      <span class="tool-item-name">${esc(tool.name)}</span>
      <span class="tool-item-desc">${esc(tool.description ?? '')}</span>
    `
    item.addEventListener('click', () => openToolPanel(tool))
    toolListEl.appendChild(item)
  }
}

function openToolPanel(tool: McpTool) {
  $('tool-list').classList.add('hidden')
  $('toolbar').classList.add('hidden')
  const panel = $('tool-panel')
  panel.classList.remove('hidden')

  $('panel-tool-name').textContent = tool.name
  $('panel-description').textContent = tool.description ?? 'No description'
  $('panel-timing').textContent = ''
  $('panel-timing').className = 'panel-timing'
  $('panel-result').classList.add('hidden')

  buildForm(tool)

  $('panel-execute').onclick = () => executeTool(tool)
  $('panel-back').onclick = closePanel
}

function closePanel() {
  $('tool-panel').classList.add('hidden')
  $('tool-list').classList.remove('hidden')
  $('toolbar').classList.remove('hidden')
}

function buildForm(tool: McpTool) {
  const form = $<HTMLFormElement>('panel-form')
  form.innerHTML = ''

  const schema = tool.inputSchema
  if (!schema?.properties || Object.keys(schema.properties).length === 0) {
    form.innerHTML = '<div class="form-hint">No parameters required</div>'
    return
  }

  const required = new Set(schema.required ?? [])

  for (const [name, prop] of Object.entries(schema.properties)) {
    const field = document.createElement('div')
    field.className = 'form-field'

    const isRequired = required.has(name)
    const type = prop.type ?? 'string'

    field.innerHTML = `
      <label class="form-label">
        ${esc(name)}${isRequired ? '<span class="required">*</span>' : ''}
        <span class="field-type">${esc(type)}</span>
      </label>
    `

    const input = createInput(name, prop)
    field.appendChild(input)

    if (prop.description) {
      const hint = document.createElement('div')
      hint.className = 'form-hint'
      hint.textContent = prop.description
      field.appendChild(hint)
    }

    form.appendChild(field)
  }
}

function createInput(name: string, prop: JsonSchemaProperty): HTMLElement {
  const type = prop.type ?? 'string'

  if (type === 'boolean') {
    const wrapper = document.createElement('div')
    wrapper.className = 'form-checkbox-wrapper'
    const cb = document.createElement('input')
    cb.type = 'checkbox'
    cb.dataset.field = name
    cb.dataset.fieldType = 'boolean'
    if (prop.default === true) cb.checked = true
    wrapper.appendChild(cb)
    wrapper.appendChild(document.createTextNode(name))
    return wrapper
  }

  if (type === 'number' || type === 'integer') {
    const input = document.createElement('input')
    input.type = 'number'
    input.className = 'form-input'
    input.dataset.field = name
    input.dataset.fieldType = type
    if (prop.default !== undefined) input.value = String(prop.default)
    input.placeholder = prop.description ?? ''
    return input
  }

  if (type === 'object' || type === 'array') {
    const ta = document.createElement('textarea')
    ta.className = 'form-textarea'
    ta.dataset.field = name
    ta.dataset.fieldType = type
    ta.placeholder = type === 'object' ? '{ }' : '[ ]'
    return ta
  }

  // Default: string
  if (prop.enum && prop.enum.length > 0) {
    const select = document.createElement('select')
    select.className = 'form-input'
    select.dataset.field = name
    select.dataset.fieldType = 'enum'
    const emptyOpt = document.createElement('option')
    emptyOpt.value = ''
    emptyOpt.textContent = '-- select --'
    select.appendChild(emptyOpt)
    for (const val of prop.enum) {
      const opt = document.createElement('option')
      opt.value = val
      opt.textContent = val
      if (prop.default === val) opt.selected = true
      select.appendChild(opt)
    }
    return select
  }

  const input = document.createElement('input')
  input.type = 'text'
  input.className = 'form-input'
  input.dataset.field = name
  input.dataset.fieldType = 'string'
  if (prop.default !== undefined) input.value = String(prop.default)
  input.placeholder = prop.description ?? ''
  return input
}

function collectFormArgs(): Record<string, unknown> {
  const args: Record<string, unknown> = {}
  const fields = document.querySelectorAll<HTMLElement>('[data-field]')

  for (const el of fields) {
    const name = el.dataset.field ?? ''
    const type = el.dataset.fieldType ?? 'string'

    if (type === 'boolean') {
      args[name] = (el as HTMLInputElement).checked
      continue
    }

    const value = (
      el as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    ).value.trim()
    if (!value) continue

    if (type === 'number' || type === 'integer') {
      args[name] = Number(value)
    } else if (type === 'object' || type === 'array') {
      try {
        args[name] = JSON.parse(value)
      } catch {
        args[name] = value
      }
    } else {
      args[name] = value
    }
  }

  return args
}

async function executeTool(tool: McpTool) {
  if (!mcpClient) return

  const btn = $<HTMLButtonElement>('panel-execute')
  const timing = $('panel-timing')
  const resultContainer = $('panel-result')
  const resultContent = $('panel-result-content')

  btn.disabled = true
  btn.textContent = 'Running...'
  timing.textContent = ''
  timing.className = 'panel-timing'
  resultContainer.classList.add('hidden')

  const args = collectFormArgs()
  const start = performance.now()

  try {
    const result = await mcpClient.callTool(tool.name, args)
    const elapsed = Math.round(performance.now() - start)
    timing.textContent = `${elapsed}ms \u2713`
    timing.className = 'panel-timing success'
    resultContent.textContent = JSON.stringify(result, null, 2)
    resultContainer.classList.remove('hidden')
  } catch (err) {
    const elapsed = Math.round(performance.now() - start)
    timing.textContent = `${elapsed}ms \u2717`
    timing.className = 'panel-timing error'
    resultContent.textContent = String(err)
    resultContainer.classList.remove('hidden')
  } finally {
    btn.disabled = false
    btn.textContent = 'Execute'
  }
}

function esc(s: string): string {
  const div = document.createElement('div')
  div.textContent = s
  return div.innerHTML
}

// Search filter
$('search-input').addEventListener('input', (e) => {
  const query = (e.target as HTMLInputElement).value.toLowerCase()
  const filtered = allTools.filter(
    (t) =>
      t.name.toLowerCase().includes(query) ||
      (t.description ?? '').toLowerCase().includes(query),
  )
  renderToolList(filtered)
  $('tool-count').textContent = `${filtered.length} tools`
})

init()
