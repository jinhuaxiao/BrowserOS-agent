import { API_TIMEOUTS, withTimeout } from '../utils/timeout'

export const SCREENSHOT_SIZES = {
  small: 512,
  medium: 768,
  large: 1028,
} as const

export type ScreenshotSizeKey = keyof typeof SCREENSHOT_SIZES

export interface InteractiveNode {
  nodeId: number
  tag: string
  type: string
  role: string
  name: string
  description: string
  placeholder: string
  value: string
  checked: boolean
  selected: boolean
  focused: boolean
  disabled: boolean
  readonly: boolean
  required: boolean
  visible: boolean
  rect: { x: number; y: number; width: number; height: number }
  attributes: Record<string, string>
}

export interface InteractiveSnapshot {
  url: string
  title: string
  elements: InteractiveNode[]
  viewportWidth: number
  viewportHeight: number
  scrollX: number
  scrollY: number
  pageWidth: number
  pageHeight: number
}

export interface PageLoadStatus {
  status: string
  url: string
}

export interface PageSnapshot {
  url: string
  title: string
  text: string
  links: Array<{ text: string; href: string }>
}

async function sendToContent<T>(
  tabId: number,
  message: Record<string, unknown>,
): Promise<T> {
  const response = await browser.tabs.sendMessage(tabId, message)
  if (!response || !response.ok) {
    throw new Error(response?.error || 'Content script did not respond')
  }
  return response.data as T
}

export class DOMAdapter {
  private static instance: DOMAdapter | null = null

  private constructor() {}

  static getInstance(): DOMAdapter {
    if (!DOMAdapter.instance) {
      DOMAdapter.instance = new DOMAdapter()
    }
    return DOMAdapter.instance
  }

  async getInteractiveSnapshot(tabId: number): Promise<InteractiveSnapshot> {
    return withTimeout(
      sendToContent<InteractiveSnapshot>(tabId, {
        type: 'getInteractiveSnapshot',
      }),
      API_TIMEOUTS.HEAVY_ACTION,
      'getInteractiveSnapshot',
    )
  }

  async click(tabId: number, nodeId: number): Promise<void> {
    await withTimeout(
      sendToContent<boolean>(tabId, { type: 'click', nodeId }),
      API_TIMEOUTS.DOM_ACTION,
      'click',
    )
  }

  async inputText(tabId: number, nodeId: number, text: string): Promise<void> {
    await withTimeout(
      sendToContent<boolean>(tabId, { type: 'inputText', nodeId, text }),
      API_TIMEOUTS.DOM_ACTION,
      'inputText',
    )
  }

  async clear(tabId: number, nodeId: number): Promise<void> {
    await withTimeout(
      sendToContent<boolean>(tabId, { type: 'clear', nodeId }),
      API_TIMEOUTS.DOM_ACTION,
      'clear',
    )
  }

  async scrollToNode(tabId: number, nodeId: number): Promise<boolean> {
    return withTimeout(
      sendToContent<boolean>(tabId, { type: 'scrollToNode', nodeId }),
      API_TIMEOUTS.DOM_ACTION,
      'scrollToNode',
    )
  }

  async sendKeys(tabId: number, keys: string): Promise<void> {
    await withTimeout(
      sendToContent<boolean>(tabId, { type: 'sendKeys', keys }),
      API_TIMEOUTS.DOM_ACTION,
      'sendKeys',
    )
  }

  async scrollDown(tabId: number): Promise<void> {
    await withTimeout(
      sendToContent<boolean>(tabId, { type: 'scrollDown' }),
      API_TIMEOUTS.DOM_ACTION,
      'scrollDown',
    )
  }

  async scrollUp(tabId: number): Promise<void> {
    await withTimeout(
      sendToContent<boolean>(tabId, { type: 'scrollUp' }),
      API_TIMEOUTS.DOM_ACTION,
      'scrollUp',
    )
  }

  async getPageLoadStatus(tabId: number): Promise<PageLoadStatus> {
    return withTimeout(
      sendToContent<PageLoadStatus>(tabId, { type: 'getPageLoadStatus' }),
      API_TIMEOUTS.DOM_ACTION,
      'getPageLoadStatus',
    )
  }

  async getSnapshot(tabId: number): Promise<PageSnapshot> {
    return withTimeout(
      sendToContent<PageSnapshot>(tabId, { type: 'getSnapshot' }),
      API_TIMEOUTS.HEAVY_ACTION,
      'getSnapshot',
    )
  }

  async executeJavaScript(tabId: number, code: string): Promise<unknown> {
    return withTimeout(
      sendToContent<unknown>(tabId, { type: 'executeJavaScript', code }),
      API_TIMEOUTS.HEAVY_ACTION,
      'executeJavaScript',
    )
  }

  async captureScreenshot(tabId: number): Promise<string> {
    // Ensure the tab is active before capturing
    const tab = await browser.tabs.get(tabId)
    if (!tab.active) {
      await browser.tabs.update(tabId, { active: true })
      // Small delay to allow rendering
      await new Promise((r) => setTimeout(r, 100))
    }

    const dataUrl = await withTimeout(
      browser.tabs.captureVisibleTab(tab.windowId!, { format: 'png' }),
      API_TIMEOUTS.HEAVY_ACTION,
      'captureScreenshot',
    )
    return dataUrl
  }

  async clickCoordinates(tabId: number, x: number, y: number): Promise<void> {
    await withTimeout(
      sendToContent<boolean>(tabId, { type: 'clickCoordinates', x, y }),
      API_TIMEOUTS.DOM_ACTION,
      'clickCoordinates',
    )
  }

  async typeAtCoordinates(
    tabId: number,
    x: number,
    y: number,
    text: string,
  ): Promise<void> {
    await withTimeout(
      sendToContent<boolean>(tabId, { type: 'typeAtCoordinates', x, y, text }),
      API_TIMEOUTS.DOM_ACTION,
      'typeAtCoordinates',
    )
  }
}

export const getDOMAdapter = () => DOMAdapter.getInstance()
