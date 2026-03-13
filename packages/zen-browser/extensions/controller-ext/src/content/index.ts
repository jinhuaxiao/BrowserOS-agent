import {
  clearInput,
  clickCoordinates,
  clickNode,
  executeJavaScript,
  getInteractiveSnapshot,
  getPageLoadStatus,
  getSnapshot,
  inputText,
  scrollDown,
  scrollToNode,
  scrollUp,
  sendKeys,
  typeAtCoordinates,
} from './dom-actions'

interface ContentMessage {
  type: string
  [key: string]: unknown
}

function parseBootstrapMessage(url: string): {
  type: string
  httpPort: number
  wsPort: number
} | null {
  try {
    const parsed = new URL(url)
    if (parsed.searchParams.get('browserosBootstrap') !== '1') {
      return null
    }
    if (!parsed.pathname.endsWith('/browseros-mcp-bootstrap.html')) {
      return null
    }

    const httpPort = Number.parseInt(
      parsed.searchParams.get('httpPort') || '',
      10,
    )
    const wsPort = Number.parseInt(parsed.searchParams.get('wsPort') || '', 10)

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

    return {
      type: 'browserosBootstrapConnectionInfo',
      httpPort,
      wsPort,
    }
  } catch {
    return null
  }
}

{
  const bootstrapMessage = parseBootstrapMessage(window.location.href)
  if (bootstrapMessage) {
    void browser.runtime.sendMessage(bootstrapMessage).catch(() => {})
  }
}

browser.runtime.onMessage.addListener(
  (message: unknown, _sender: browser.runtime.MessageSender) => {
    try {
      const request = message as ContentMessage
      switch (request.type) {
        case 'getInteractiveSnapshot':
          return Promise.resolve({ ok: true, data: getInteractiveSnapshot() })

        case 'click':
          return Promise.resolve({
            ok: true,
            data: clickNode(request.nodeId as number),
          })

        case 'inputText':
          return Promise.resolve({
            ok: true,
            data: inputText(request.nodeId as number, request.text as string),
          })

        case 'clear':
          return Promise.resolve({
            ok: true,
            data: clearInput(request.nodeId as number),
          })

        case 'scrollToNode':
          return Promise.resolve({
            ok: true,
            data: scrollToNode(request.nodeId as number),
          })

        case 'sendKeys':
          return Promise.resolve({
            ok: true,
            data: sendKeys(request.keys as string),
          })

        case 'scrollDown':
          return Promise.resolve({ ok: true, data: scrollDown() })

        case 'scrollUp':
          return Promise.resolve({ ok: true, data: scrollUp() })

        case 'getPageLoadStatus':
          return Promise.resolve({ ok: true, data: getPageLoadStatus() })

        case 'getSnapshot':
          return Promise.resolve({ ok: true, data: getSnapshot() })

        case 'executeJavaScript':
          return Promise.resolve({
            ok: true,
            data: executeJavaScript(request.code as string),
          })

        case 'clickCoordinates':
          return Promise.resolve({
            ok: true,
            data: clickCoordinates(request.x as number, request.y as number),
          })

        case 'typeAtCoordinates':
          return Promise.resolve({
            ok: true,
            data: typeAtCoordinates(
              request.x as number,
              request.y as number,
              request.text as string,
            ),
          })

        default:
          return Promise.resolve({
            ok: false,
            error: `Unknown content action: ${request.type}`,
          })
      }
    } catch (error) {
      return Promise.resolve({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  },
)
