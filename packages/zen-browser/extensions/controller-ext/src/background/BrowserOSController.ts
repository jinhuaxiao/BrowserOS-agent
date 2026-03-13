import { ActionRegistry } from '../actions/ActionRegistry'
import { CreateBookmarkAction } from '../actions/bookmark/CreateBookmarkAction'
import { CreateBookmarkFolderAction } from '../actions/bookmark/CreateBookmarkFolderAction'
import { GetBookmarkChildrenAction } from '../actions/bookmark/GetBookmarkChildrenAction'
import { GetBookmarksAction } from '../actions/bookmark/GetBookmarksAction'
import { MoveBookmarkAction } from '../actions/bookmark/MoveBookmarkAction'
import { RemoveBookmarkAction } from '../actions/bookmark/RemoveBookmarkAction'
import { RemoveBookmarkTreeAction } from '../actions/bookmark/RemoveBookmarkTreeAction'
import { UpdateBookmarkAction } from '../actions/bookmark/UpdateBookmarkAction'
import { CaptureScreenshotAction } from '../actions/browser/CaptureScreenshotAction'
import { ClearAction } from '../actions/browser/ClearAction'
import { ClickAction } from '../actions/browser/ClickAction'
import { ClickCoordinatesAction } from '../actions/browser/ClickCoordinatesAction'
import { CloseWindowAction } from '../actions/browser/CloseWindowAction'
import { CreateWindowAction } from '../actions/browser/CreateWindowAction'
import { ExecuteJavaScriptAction } from '../actions/browser/ExecuteJavaScriptAction'
import { GetInteractiveSnapshotAction } from '../actions/browser/GetInteractiveSnapshotAction'
import { GetPageLoadStatusAction } from '../actions/browser/GetPageLoadStatusAction'
import { GetSnapshotAction } from '../actions/browser/GetSnapshotAction'
import { InputTextAction } from '../actions/browser/InputTextAction'
import { ScrollDownAction } from '../actions/browser/ScrollDownAction'
import { ScrollToNodeAction } from '../actions/browser/ScrollToNodeAction'
import { ScrollUpAction } from '../actions/browser/ScrollUpAction'
import { SendKeysAction } from '../actions/browser/SendKeysAction'
import { TypeAtCoordinatesAction } from '../actions/browser/TypeAtCoordinatesAction'
import { CheckBrowserOSAction } from '../actions/diagnostics/CheckBrowserOSAction'
import { GetRecentHistoryAction } from '../actions/history/GetRecentHistoryAction'
import { SearchHistoryAction } from '../actions/history/SearchHistoryAction'
import { CloseTabAction } from '../actions/tab/CloseTabAction'
import { GetActiveTabAction } from '../actions/tab/GetActiveTabAction'
import { GetTabsAction } from '../actions/tab/GetTabsAction'
import { NavigateAction } from '../actions/tab/NavigateAction'
import { OpenTabAction } from '../actions/tab/OpenTabAction'
import { SwitchTabAction } from '../actions/tab/SwitchTabAction'
import { CONCURRENCY_CONFIG } from '../config/constants'
import type { ProtocolRequest, ProtocolResponse } from '../protocol/types'
import { ConnectionStatus } from '../protocol/types'
import { ConcurrencyLimiter } from '../utils/ConcurrencyLimiter'
import { logger } from '../utils/logger'
import { RequestTracker } from '../utils/RequestTracker'
import { RequestValidator } from '../utils/RequestValidator'
import { ResponseQueue } from '../utils/ResponseQueue'
import type { PortProvider } from '../websocket/WebSocketClient'
import { WebSocketClient } from '../websocket/WebSocketClient'

export class BrowserOSController {
  private wsClient: WebSocketClient
  private requestTracker: RequestTracker
  private concurrencyLimiter: ConcurrencyLimiter
  private requestValidator: RequestValidator
  private responseQueue: ResponseQueue
  private actionRegistry: ActionRegistry
  private httpPort: number | null = null
  private connectionChangeHandlers = new Set<() => void>()

  constructor(getPort: PortProvider) {
    logger.info('Initializing BrowserOS Controller (Firefox)...')

    this.requestTracker = new RequestTracker()
    this.concurrencyLimiter = new ConcurrencyLimiter(
      CONCURRENCY_CONFIG.maxConcurrent,
      CONCURRENCY_CONFIG.maxQueueSize,
    )
    this.requestValidator = new RequestValidator()
    this.responseQueue = new ResponseQueue()
    this.wsClient = new WebSocketClient(getPort)
    this.actionRegistry = new ActionRegistry()

    this.registerActions()
    this.setupWebSocketHandlers()
  }

  async start(): Promise<void> {
    logger.info('Starting BrowserOS Controller...')
    await this.wsClient.connect()
    await this.reportOwnedWindows()
  }

  private async reportOwnedWindows(): Promise<void> {
    try {
      const windows = await browser.windows.getAll()
      const windowIds = windows
        .map((w) => w.id)
        .filter((id): id is number => id !== undefined)

      if (windowIds.length > 0) {
        this.wsClient.send({ type: 'register_windows', windowIds })
        logger.info('Reported owned windows', { windowCount: windowIds.length })
      }
    } catch (error) {
      logger.warn('Failed to report owned windows', {
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  notifyWindowCreated(windowId: number): void {
    try {
      this.wsClient.send({ type: 'window_created', windowId })
    } catch {}
  }

  notifyWindowRemoved(windowId: number): void {
    try {
      this.wsClient.send({ type: 'window_removed', windowId })
    } catch {}
  }

  notifyWindowFocused(windowId?: number): void {
    try {
      this.wsClient.send({ type: 'focused', windowId })
    } catch {}
  }

  stop(): void {
    logger.info('Stopping BrowserOS Controller...')
    this.wsClient.disconnect()
    this.requestTracker.destroy()
    this.requestValidator.destroy()
    this.responseQueue.clear()
    this.emitConnectionChange()
  }

  logStats(): void {
    const stats = this.getStats()
    logger.info(
      `Stats: conn=${stats.connection}, requests=${JSON.stringify(stats.requests)}, queue=${stats.responseQueue.size}`,
    )
  }

  getStats() {
    return {
      connection: this.wsClient.getStatus(),
      requests: this.requestTracker.getStats(),
      concurrency: this.concurrencyLimiter.getStats(),
      validator: this.requestValidator.getStats(),
      responseQueue: { size: this.responseQueue.size() },
    }
  }

  isConnected(): boolean {
    return this.wsClient.isConnected()
  }

  getHttpPort(): number | null {
    return this.httpPort
  }

  onConnectionChange(handler: () => void): void {
    this.connectionChangeHandlers.add(handler)
  }

  private registerActions(): void {
    // Diagnostics
    this.actionRegistry.register('checkBrowserOS', new CheckBrowserOSAction())

    // Tab actions (no tab groups in Firefox)
    this.actionRegistry.register('getActiveTab', new GetActiveTabAction())
    this.actionRegistry.register('getTabs', new GetTabsAction())
    this.actionRegistry.register('openTab', new OpenTabAction())
    this.actionRegistry.register('closeTab', new CloseTabAction())
    this.actionRegistry.register('switchTab', new SwitchTabAction())
    this.actionRegistry.register('navigate', new NavigateAction())

    // Window actions
    this.actionRegistry.register('createWindow', new CreateWindowAction())
    this.actionRegistry.register('closeWindow', new CloseWindowAction())

    // Bookmark actions
    this.actionRegistry.register('getBookmarks', new GetBookmarksAction())
    this.actionRegistry.register('createBookmark', new CreateBookmarkAction())
    this.actionRegistry.register('removeBookmark', new RemoveBookmarkAction())
    this.actionRegistry.register('updateBookmark', new UpdateBookmarkAction())
    this.actionRegistry.register(
      'createBookmarkFolder',
      new CreateBookmarkFolderAction(),
    )
    this.actionRegistry.register(
      'getBookmarkChildren',
      new GetBookmarkChildrenAction(),
    )
    this.actionRegistry.register('moveBookmark', new MoveBookmarkAction())
    this.actionRegistry.register(
      'removeBookmarkTree',
      new RemoveBookmarkTreeAction(),
    )

    // History actions
    this.actionRegistry.register('searchHistory', new SearchHistoryAction())
    this.actionRegistry.register(
      'getRecentHistory',
      new GetRecentHistoryAction(),
    )

    // Browser/DOM actions (via content script)
    this.actionRegistry.register(
      'getInteractiveSnapshot',
      new GetInteractiveSnapshotAction(),
    )
    this.actionRegistry.register('click', new ClickAction())
    this.actionRegistry.register('inputText', new InputTextAction())
    this.actionRegistry.register('clear', new ClearAction())
    this.actionRegistry.register('scrollToNode', new ScrollToNodeAction())
    this.actionRegistry.register(
      'captureScreenshot',
      new CaptureScreenshotAction(),
    )
    this.actionRegistry.register('scrollDown', new ScrollDownAction())
    this.actionRegistry.register('scrollUp', new ScrollUpAction())
    this.actionRegistry.register(
      'executeJavaScript',
      new ExecuteJavaScriptAction(),
    )
    this.actionRegistry.register('sendKeys', new SendKeysAction())
    this.actionRegistry.register(
      'getPageLoadStatus',
      new GetPageLoadStatusAction(),
    )
    this.actionRegistry.register('getSnapshot', new GetSnapshotAction())
    this.actionRegistry.register(
      'clickCoordinates',
      new ClickCoordinatesAction(),
    )
    this.actionRegistry.register(
      'typeAtCoordinates',
      new TypeAtCoordinatesAction(),
    )

    const actions = this.actionRegistry.getAvailableActions()
    logger.info(`Registered ${actions.length} actions: ${actions.join(', ')}`)
  }

  private setupWebSocketHandlers(): void {
    this.wsClient.onInit((data) => {
      this.httpPort = data.httpPort
      logger.info('Received MCP HTTP port from server', {
        httpPort: data.httpPort,
      })
      this.emitConnectionChange()
    })

    this.wsClient.onMessage((message: ProtocolResponse) => {
      this.handleIncomingMessage(message)
    })

    this.wsClient.onStatusChange((status: ConnectionStatus) => {
      this.handleStatusChange(status)
    })
  }

  private handleIncomingMessage(message: ProtocolResponse): void {
    const rawMessage = message as ProtocolResponse & Partial<ProtocolRequest>

    if (rawMessage.action) {
      this.processRequest(rawMessage).catch((error) => {
        logger.error(
          `Unhandled error processing request ${rawMessage.id}: ${error}`,
        )
      })
    } else if (rawMessage.ok !== undefined) {
      logger.info(
        `Server message: ${rawMessage.id} - ${rawMessage.ok ? 'ok' : 'error'}`,
      )
    }
  }

  private async processRequest(request: unknown): Promise<void> {
    let validatedRequest: ProtocolRequest
    let requestId: string | undefined

    try {
      validatedRequest = this.requestValidator.validate(request)
      requestId = validatedRequest.id

      this.requestTracker.start(validatedRequest.id, validatedRequest.action)

      await this.concurrencyLimiter.execute(async () => {
        this.requestTracker.markExecuting(validatedRequest.id)
        await this.executeAction(validatedRequest)
      })

      this.requestTracker.complete(validatedRequest.id)
      this.requestValidator.markComplete(validatedRequest.id)
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      logger.error(`Request processing failed: ${errorMessage}`)

      if (requestId) {
        this.requestTracker.complete(requestId, errorMessage)
        this.requestValidator.markComplete(requestId)
        this.sendResponse({ id: requestId, ok: false, error: errorMessage })
      }
    }
  }

  private async executeAction(request: ProtocolRequest): Promise<void> {
    logger.info(`Executing: ${request.action} [${request.id}]`)

    const actionResponse = await this.actionRegistry.dispatch(
      request.action,
      request.payload,
    )

    this.sendResponse({
      id: request.id,
      ok: actionResponse.ok,
      data: actionResponse.data,
      error: actionResponse.error,
    })
  }

  private sendResponse(response: ProtocolResponse): void {
    try {
      if (this.wsClient.isConnected()) {
        this.wsClient.send(response)
      } else {
        this.responseQueue.enqueue(response)
      }
    } catch (error) {
      logger.error(`Failed to send response ${response.id}: ${error}`)
      this.responseQueue.enqueue(response)
    }
  }

  private handleStatusChange(status: ConnectionStatus): void {
    logger.info(`Connection status: ${status}`)
    this.emitConnectionChange()

    if (
      status === ConnectionStatus.CONNECTED &&
      !this.responseQueue.isEmpty()
    ) {
      logger.info(`Flushing ${this.responseQueue.size()} queued responses...`)
      this.responseQueue.flush((response) => {
        this.wsClient.send(response)
      })
    }
  }

  private emitConnectionChange(): void {
    for (const handler of this.connectionChangeHandlers) {
      try {
        handler()
      } catch (error) {
        logger.warn('Connection change handler failed', {
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }
  }
}
