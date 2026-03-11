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

browser.runtime.onMessage.addListener(
  (message: ContentMessage, _sender: browser.runtime.MessageSender) => {
    try {
      switch (message.type) {
        case 'getInteractiveSnapshot':
          return Promise.resolve({ ok: true, data: getInteractiveSnapshot() })

        case 'click':
          return Promise.resolve({
            ok: true,
            data: clickNode(message.nodeId as number),
          })

        case 'inputText':
          return Promise.resolve({
            ok: true,
            data: inputText(message.nodeId as number, message.text as string),
          })

        case 'clear':
          return Promise.resolve({
            ok: true,
            data: clearInput(message.nodeId as number),
          })

        case 'scrollToNode':
          return Promise.resolve({
            ok: true,
            data: scrollToNode(message.nodeId as number),
          })

        case 'sendKeys':
          return Promise.resolve({
            ok: true,
            data: sendKeys(message.keys as string),
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
            data: executeJavaScript(message.code as string),
          })

        case 'clickCoordinates':
          return Promise.resolve({
            ok: true,
            data: clickCoordinates(message.x as number, message.y as number),
          })

        case 'typeAtCoordinates':
          return Promise.resolve({
            ok: true,
            data: typeAtCoordinates(
              message.x as number,
              message.y as number,
              message.text as string,
            ),
          })

        default:
          return Promise.resolve({
            ok: false,
            error: `Unknown content action: ${message.type}`,
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
