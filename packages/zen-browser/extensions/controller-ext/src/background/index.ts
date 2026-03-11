import { WEBSOCKET_CONFIG } from '../config/constants'
import { logger } from '../utils/logger'
import { BrowserOSController } from './BrowserOSController'

const STATS_LOG_INTERVAL_MS = 30000

let controller: BrowserOSController | null = null
let initPromise: Promise<BrowserOSController> | null = null
let _statsTimer: ReturnType<typeof setInterval> | null = null

async function getWebSocketPort(): Promise<number> {
  return WEBSOCKET_CONFIG.defaultExtensionPort
}

async function getOrCreateController(): Promise<BrowserOSController> {
  if (controller) return controller

  if (!initPromise) {
    initPromise = (async () => {
      try {
        const ctrl = new BrowserOSController(getWebSocketPort)
        await ctrl.start()
        controller = ctrl
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
    .then((ctrl) => ctrl.notifyWindowCreated(window.id!))
    .catch(() => {})
})

browser.windows.onRemoved.addListener((windowId) => {
  getOrCreateController()
    .then((ctrl) => ctrl.notifyWindowRemoved(windowId))
    .catch(() => {})
})
