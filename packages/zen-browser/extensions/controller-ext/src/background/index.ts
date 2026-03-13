import { WEBSOCKET_CONFIG } from '../config/constants'
import { logger } from '../utils/logger'
import { BrowserOSController } from './BrowserOSController'

const STATS_LOG_INTERVAL_MS = 30000

interface PersistedConnectionInfo {
  httpPort: number | null
  wsPort: number | null
  connected: boolean
  updatedAt: number
}

let controller: BrowserOSController | null = null
let initPromise: Promise<BrowserOSController> | null = null
let _statsTimer: ReturnType<typeof setInterval> | null = null
let cachedHttpPort: number | null = null
let cachedWsPort: number | null = null

function persistConnectionInfo() {
  const httpPort = controller?.getHttpPort() ?? cachedHttpPort
  if (httpPort) {
    cachedHttpPort = httpPort
  }
  const info: PersistedConnectionInfo = {
    httpPort,
    wsPort: cachedWsPort,
    connected: controller?.isConnected() ?? false,
    updatedAt: Date.now(),
  }
  browser.storage.local
    .set({ connectionInfo: info as unknown as Record<string, unknown> })
    .catch(() => {})
  logger.info('Persisted connection info to storage', {
    httpPort: info.httpPort,
    wsPort: info.wsPort,
    connected: info.connected,
    updatedAt: info.updatedAt,
  })
}

async function readPersistedConnectionInfo(): Promise<PersistedConnectionInfo | null> {
  try {
    const result = (await browser.storage.local.get('connectionInfo')) as {
      connectionInfo?: Partial<PersistedConnectionInfo>
    }
    const info = result.connectionInfo
    if (!info || typeof info !== 'object') {
      return null
    }

    return {
      httpPort: typeof info.httpPort === 'number' ? info.httpPort : null,
      wsPort: typeof info.wsPort === 'number' ? info.wsPort : null,
      connected: info.connected === true,
      updatedAt: typeof info.updatedAt === 'number' ? info.updatedAt : 0,
    }
  } catch (error) {
    logger.warn('Failed to read persisted connection info', {
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

async function resolveWsPortFromHttpPort(
  httpPort: number,
): Promise<number | null> {
  try {
    const response = await fetch(`http://127.0.0.1:${httpPort}/health`, {
      signal: AbortSignal.timeout(2000),
    })
    if (!response.ok) {
      return null
    }

    const data = (await response.json()) as { extensionPort?: number }
    if (
      typeof data.extensionPort === 'number' &&
      data.extensionPort >= 9400 &&
      data.extensionPort <= 9499
    ) {
      return data.extensionPort
    }
  } catch (error) {
    logger.warn('Failed to resolve WS port from persisted HTTP port', {
      httpPort,
      error: error instanceof Error ? error.message : String(error),
    })
  }

  return null
}

async function canConnectToWsPort(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const url = `${WEBSOCKET_CONFIG.protocol}://${WEBSOCKET_CONFIG.host}:${port}${WEBSOCKET_CONFIG.path}`
      const ws = new WebSocket(url)
      const timeout = setTimeout(() => {
        try {
          ws.close()
        } catch {}
        resolve(false)
      }, 1000)

      ws.onopen = () => {
        clearTimeout(timeout)
        ws.close()
        resolve(true)
      }
      ws.onerror = () => {
        clearTimeout(timeout)
        resolve(false)
      }
      ws.onclose = () => {
        clearTimeout(timeout)
      }
    } catch {
      resolve(false)
    }
  })
}

async function getWebSocketPort(): Promise<number> {
  if (cachedWsPort) return cachedWsPort

  const bootstrapInfo = await waitForBootstrapConnectionInfo(2500)
  if (bootstrapInfo) {
    cachedHttpPort = bootstrapInfo.httpPort
    cachedWsPort = bootstrapInfo.wsPort
    persistConnectionInfo()
    logger.info('WS port restored from bootstrap tab', {
      httpPort: bootstrapInfo.httpPort,
      wsPort: bootstrapInfo.wsPort,
    })
    return bootstrapInfo.wsPort
  }

  const persistedInfo = await readPersistedConnectionInfo()
  if (persistedInfo?.httpPort) {
    logger.info('Trying persisted HTTP port before scanning', {
      httpPort: persistedInfo.httpPort,
    })
    const wsPort = await resolveWsPortFromHttpPort(persistedInfo.httpPort)
    if (wsPort) {
      cachedWsPort = wsPort
      logger.info('WS port restored from persisted HTTP port', { port: wsPort })
      return wsPort
    }
  }

  if (persistedInfo?.wsPort) {
    logger.info('Trying persisted WS port before scanning', {
      port: persistedInfo.wsPort,
    })
    if (await canConnectToWsPort(persistedInfo.wsPort)) {
      cachedWsPort = persistedInfo.wsPort
      logger.info('WS port restored from persisted WS port', {
        port: persistedInfo.wsPort,
      })
      return persistedInfo.wsPort
    }
  }

  // Strategy 1: Discover WS port via MCP HTTP health endpoint
  try {
    logger.info('Attempting HTTP health discovery for WS port...')
    const wsPort = await discoverWsPortViaHttp()
    if (wsPort) {
      cachedWsPort = wsPort
      logger.info('WS port discovered via HTTP health', { port: wsPort })
      return wsPort
    }
    logger.warn('HTTP health discovery returned no Zen WS port')
  } catch (e) {
    logger.error('HTTP health discovery threw error', {
      error: e instanceof Error ? e.message : String(e),
    })
  }

  // Strategy 2: Direct WebSocket scan on 9400-9499
  try {
    logger.info('Falling back to direct WS port scan (9400-9499)...')
    const wsPort = await scanWsPorts(9400, 9499)
    if (wsPort) {
      cachedWsPort = wsPort
      logger.info('WS port discovered via direct scan', { port: wsPort })
      return wsPort
    }
    logger.warn('Direct WS scan found no server')
  } catch (e) {
    logger.error('WS port scan threw error', {
      error: e instanceof Error ? e.message : String(e),
    })
  }

  logger.warn('All discovery failed, using default port', {
    port: WEBSOCKET_CONFIG.defaultExtensionPort,
  })
  return WEBSOCKET_CONFIG.defaultExtensionPort
}

function parseBootstrapConnectionInfo(
  rawUrl: string | undefined,
): { httpPort: number; wsPort: number } | null {
  if (!rawUrl) {
    return null
  }

  try {
    const url = new URL(rawUrl)
    if (url.searchParams.get('browserosBootstrap') !== '1') {
      return null
    }
    if (!url.pathname.endsWith('/browseros-mcp-bootstrap.html')) {
      return null
    }

    const httpPort = Number.parseInt(url.searchParams.get('httpPort') || '', 10)
    const wsPort = Number.parseInt(url.searchParams.get('wsPort') || '', 10)

    if (
      !Number.isInteger(httpPort) ||
      !Number.isInteger(wsPort) ||
      httpPort < 9100 ||
      httpPort > 9199 ||
      wsPort < 9400 ||
      wsPort > 9499
    ) {
      return null
    }

    return { httpPort, wsPort }
  } catch {
    return null
  }
}

async function findBootstrapConnectionInfoInTabs(): Promise<{
  httpPort: number
  wsPort: number
} | null> {
  try {
    const tabs = await browser.tabs.query({})
    for (const tab of tabs) {
      const info = parseBootstrapConnectionInfo(tab.url)
      if (info) {
        return info
      }
    }
  } catch (error) {
    logger.warn('Failed to inspect tabs for bootstrap info', {
      error: error instanceof Error ? error.message : String(error),
    })
  }

  return null
}

async function waitForBootstrapConnectionInfo(
  timeoutMs: number,
): Promise<{ httpPort: number; wsPort: number } | null> {
  const start = Date.now()

  while (Date.now() - start < timeoutMs) {
    const info = await findBootstrapConnectionInfoInTabs()
    if (info) {
      return info
    }
    await new Promise((resolve) => setTimeout(resolve, 150))
  }

  return null
}

async function discoverWsPortViaHttp(): Promise<number | null> {
  const checks: Promise<number | null>[] = []
  for (let port = 9100; port <= 9199; port++) {
    checks.push(
      fetch(`http://127.0.0.1:${port}/health`, {
        signal: AbortSignal.timeout(2000),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data: { extensionPort?: number } | null) => {
          if (
            data?.extensionPort &&
            data.extensionPort >= 9400 &&
            data.extensionPort <= 9499
          ) {
            return data.extensionPort
          }
          return null
        })
        .catch(() => null),
    )
  }
  const results = await Promise.all(checks)
  return results.find((p) => p !== null) ?? null
}

async function scanWsPorts(min: number, max: number): Promise<number | null> {
  const checks: Promise<number | null>[] = []
  for (let port = min; port <= max; port++) {
    checks.push(
      new Promise<number | null>((resolve) => {
        try {
          const url = `${WEBSOCKET_CONFIG.protocol}://${WEBSOCKET_CONFIG.host}:${port}${WEBSOCKET_CONFIG.path}`
          const ws = new WebSocket(url)
          const timeout = setTimeout(() => {
            ws.close()
            resolve(null)
          }, 1000)
          ws.onopen = () => {
            clearTimeout(timeout)
            ws.close()
            resolve(port)
          }
          ws.onerror = () => {
            clearTimeout(timeout)
            resolve(null)
          }
        } catch {
          resolve(null)
        }
      }),
    )
  }
  const results = await Promise.all(checks)
  return results.find((p) => p !== null) ?? null
}

async function getOrCreateController(): Promise<BrowserOSController> {
  if (controller) return controller

  if (!initPromise) {
    initPromise = (async () => {
      try {
        const ctrl = new BrowserOSController(getWebSocketPort)

        // Persist connection info when status or httpPort changes
        ctrl.onConnectionChange(() => persistConnectionInfo())

        await ctrl.start()
        controller = ctrl
        persistConnectionInfo()

        _statsTimer = setInterval(
          () => controller?.logStats(),
          STATS_LOG_INTERVAL_MS,
        )
        return ctrl
      } catch (error) {
        controller = null
        throw error
      } finally {
        initPromise = null
      }
    })()
  }

  return initPromise
}

function ensureControllerRunning(trigger: string): void {
  getOrCreateController().catch((error) => {
    const message =
      error instanceof Error ? error.message : JSON.stringify(error)
    logger.error('Controller failed to start', { trigger, error: message })
  })
}

logger.info('BrowserOS Controller Extension loaded (Firefox)')

// Firefox MV2: persistent background script, start immediately
ensureControllerRunning('background-init')

// Handle messages from popup (fallback for runtime.sendMessage)
browser.runtime.onMessage.addListener((message: unknown) => {
  const request = message as { type?: string }
  if (request.type === 'browserosBootstrapConnectionInfo') {
    const info = request as {
      httpPort?: number
      wsPort?: number
    }
    if (typeof info.httpPort === 'number' && typeof info.wsPort === 'number') {
      cachedHttpPort = info.httpPort
      cachedWsPort = info.wsPort
      persistConnectionInfo()
    }
    return Promise.resolve({ ok: true })
  }
  if (request.type === 'getConnectionInfo') {
    return Promise.resolve({
      httpPort: controller?.getHttpPort() ?? cachedHttpPort,
      connected: controller?.isConnected() ?? false,
    })
  }
  return undefined
})

// Window lifecycle events
browser.windows.onFocusChanged.addListener((windowId) => {
  if (windowId === browser.windows.WINDOW_ID_NONE) return
  getOrCreateController()
    .then((ctrl) => ctrl.notifyWindowFocused(windowId))
    .catch(() => {})
})

browser.windows.onCreated.addListener((window) => {
  if (window.id === undefined) return
  getOrCreateController()
    .then((ctrl) => ctrl.notifyWindowCreated(window.id as number))
    .catch(() => {})
})

browser.windows.onRemoved.addListener((windowId) => {
  getOrCreateController()
    .then((ctrl) => ctrl.notifyWindowRemoved(windowId))
    .catch(() => {})
})
