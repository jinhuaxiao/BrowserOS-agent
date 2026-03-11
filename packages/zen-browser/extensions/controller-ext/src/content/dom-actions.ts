const elementRegistry = new Map<number, Element>()
let nextNodeId = 1

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

const INTERACTIVE_SELECTORS = [
  'a[href]',
  'button',
  'input',
  'select',
  'textarea',
  '[role="button"]',
  '[role="link"]',
  '[role="checkbox"]',
  '[role="radio"]',
  '[role="tab"]',
  '[role="menuitem"]',
  '[role="option"]',
  '[role="switch"]',
  '[role="textbox"]',
  '[role="combobox"]',
  '[role="searchbox"]',
  '[role="slider"]',
  '[role="spinbutton"]',
  '[onclick]',
  '[tabindex]',
  'summary',
  'details',
  '[contenteditable="true"]',
  '[contenteditable=""]',
].join(', ')

function isElementVisible(el: Element): boolean {
  const style = getComputedStyle(el)
  if (
    style.display === 'none' ||
    style.visibility === 'hidden' ||
    style.opacity === '0'
  )
    return false
  const rect = el.getBoundingClientRect()
  if (rect.width === 0 && rect.height === 0) return false
  return true
}

function getElementType(el: Element): string {
  const tag = el.tagName.toLowerCase()
  if (tag === 'input') return (el as HTMLInputElement).type || 'text'
  if (tag === 'a') return 'link'
  if (tag === 'button') return 'button'
  if (tag === 'select') return 'select'
  if (tag === 'textarea') return 'textarea'
  if (el.getAttribute('contenteditable')) return 'contenteditable'
  return el.getAttribute('role') || tag
}

function getElementName(el: Element): string {
  // aria-label > aria-labelledby > innerText > title > alt > placeholder > name
  const ariaLabel = el.getAttribute('aria-label')
  if (ariaLabel) return ariaLabel.trim()

  const labelledBy = el.getAttribute('aria-labelledby')
  if (labelledBy) {
    const labelEl = document.getElementById(labelledBy)
    if (labelEl) return labelEl.textContent?.trim() || ''
  }

  // For inputs, check associated label
  if (el.id) {
    const label = document.querySelector(`label[for="${el.id}"]`)
    if (label) return label.textContent?.trim() || ''
  }

  const text = el.textContent?.trim() || ''
  if (text.length > 0 && text.length <= 200) return text

  return (
    el.getAttribute('title') ||
    el.getAttribute('alt') ||
    el.getAttribute('placeholder') ||
    el.getAttribute('name') ||
    ''
  )
}

function getRelevantAttributes(el: Element): Record<string, string> {
  const attrs: Record<string, string> = {}
  const relevant = [
    'href',
    'src',
    'action',
    'data-testid',
    'data-id',
    'class',
    'id',
    'name',
    'type',
    'aria-label',
    'aria-expanded',
    'aria-haspopup',
    'aria-selected',
  ]
  for (const name of relevant) {
    const val = el.getAttribute(name)
    if (val)
      attrs[name] = val.length > 200 ? `${val.substring(0, 200)}...` : val
  }
  return attrs
}

export function getInteractiveSnapshot(): InteractiveSnapshot {
  elementRegistry.clear()
  nextNodeId = 1

  const allElements = document.querySelectorAll(INTERACTIVE_SELECTORS)
  const nodes: InteractiveNode[] = []

  for (const el of allElements) {
    if (!isElementVisible(el)) continue

    const nodeId = nextNodeId++
    elementRegistry.set(nodeId, el)

    const rect = el.getBoundingClientRect()
    const htmlEl = el as HTMLInputElement

    nodes.push({
      nodeId,
      tag: el.tagName.toLowerCase(),
      type: getElementType(el),
      role: el.getAttribute('role') || '',
      name: getElementName(el),
      description: el.getAttribute('aria-description') || '',
      placeholder: htmlEl.placeholder || '',
      value: htmlEl.value || '',
      checked: htmlEl.checked || false,
      selected: htmlEl.selected || false,
      focused: document.activeElement === el,
      disabled: htmlEl.disabled || false,
      readonly: htmlEl.readOnly || false,
      required: htmlEl.required || false,
      visible: true,
      rect: {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      },
      attributes: getRelevantAttributes(el),
    })
  }

  return {
    url: location.href,
    title: document.title,
    elements: nodes,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    scrollX: window.scrollX,
    scrollY: window.scrollY,
    pageWidth: document.documentElement.scrollWidth,
    pageHeight: document.documentElement.scrollHeight,
  }
}

export function clickNode(nodeId: number): boolean {
  const el = elementRegistry.get(nodeId)
  if (!el)
    throw new Error(`Node ${nodeId} not found. Get a fresh snapshot first.`)

  el.scrollIntoView({ behavior: 'instant', block: 'center' })

  const rect = el.getBoundingClientRect()
  const x = rect.x + rect.width / 2
  const y = rect.y + rect.height / 2

  el.dispatchEvent(
    new MouseEvent('mouseover', { bubbles: true, clientX: x, clientY: y }),
  )
  el.dispatchEvent(
    new MouseEvent('mousedown', { bubbles: true, clientX: x, clientY: y }),
  )
  el.dispatchEvent(
    new MouseEvent('mouseup', { bubbles: true, clientX: x, clientY: y }),
  )
  el.dispatchEvent(
    new MouseEvent('click', { bubbles: true, clientX: x, clientY: y }),
  )
  return true
}

export function inputText(nodeId: number, text: string): boolean {
  const el = elementRegistry.get(nodeId)
  if (!el)
    throw new Error(`Node ${nodeId} not found. Get a fresh snapshot first.`)

  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    el.focus()
    el.value = text
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  } else if (el.getAttribute('contenteditable') !== null) {
    el.focus()
    ;(el as HTMLElement).textContent = text
    el.dispatchEvent(new Event('input', { bubbles: true }))
  } else {
    throw new Error(`Node ${nodeId} is not an input element`)
  }
  return true
}

export function clearInput(nodeId: number): boolean {
  const el = elementRegistry.get(nodeId)
  if (!el)
    throw new Error(`Node ${nodeId} not found. Get a fresh snapshot first.`)

  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    el.focus()
    el.value = ''
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  } else if (el.getAttribute('contenteditable') !== null) {
    el.focus()
    ;(el as HTMLElement).textContent = ''
    el.dispatchEvent(new Event('input', { bubbles: true }))
  } else {
    throw new Error(`Node ${nodeId} is not an input element`)
  }
  return true
}

export function scrollToNode(nodeId: number): boolean {
  const el = elementRegistry.get(nodeId)
  if (!el)
    throw new Error(`Node ${nodeId} not found. Get a fresh snapshot first.`)
  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  return true
}

const KEY_MAP: Record<string, { key: string; code: string; keyCode: number }> =
  {
    Enter: { key: 'Enter', code: 'Enter', keyCode: 13 },
    Tab: { key: 'Tab', code: 'Tab', keyCode: 9 },
    Escape: { key: 'Escape', code: 'Escape', keyCode: 27 },
    Backspace: { key: 'Backspace', code: 'Backspace', keyCode: 8 },
    Delete: { key: 'Delete', code: 'Delete', keyCode: 46 },
    ArrowUp: { key: 'ArrowUp', code: 'ArrowUp', keyCode: 38 },
    ArrowDown: { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40 },
    ArrowLeft: { key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37 },
    ArrowRight: { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39 },
    PageUp: { key: 'PageUp', code: 'PageUp', keyCode: 33 },
    PageDown: { key: 'PageDown', code: 'PageDown', keyCode: 34 },
    Home: { key: 'Home', code: 'Home', keyCode: 36 },
    End: { key: 'End', code: 'End', keyCode: 35 },
    Space: { key: ' ', code: 'Space', keyCode: 32 },
  }

export function sendKeys(keys: string): boolean {
  const target = document.activeElement || document.body
  const mapped = KEY_MAP[keys]

  if (mapped) {
    target.dispatchEvent(
      new KeyboardEvent('keydown', { ...mapped, bubbles: true }),
    )
    target.dispatchEvent(
      new KeyboardEvent('keypress', { ...mapped, bubbles: true }),
    )
    target.dispatchEvent(
      new KeyboardEvent('keyup', { ...mapped, bubbles: true }),
    )
  } else {
    // Type each character
    for (const char of keys) {
      target.dispatchEvent(
        new KeyboardEvent('keydown', { key: char, bubbles: true }),
      )
      target.dispatchEvent(
        new KeyboardEvent('keypress', { key: char, bubbles: true }),
      )
      target.dispatchEvent(
        new KeyboardEvent('keyup', { key: char, bubbles: true }),
      )
    }
  }
  return true
}

export function scrollDown(): boolean {
  window.scrollBy(0, window.innerHeight * 0.85)
  return true
}

export function scrollUp(): boolean {
  window.scrollBy(0, -window.innerHeight * 0.85)
  return true
}

export function getPageLoadStatus(): { status: string; url: string } {
  return {
    status: document.readyState,
    url: location.href,
  }
}

export function getSnapshot(): {
  url: string
  title: string
  text: string
  links: Array<{ text: string; href: string }>
} {
  const links: Array<{ text: string; href: string }> = []
  const anchors = document.querySelectorAll('a[href]')
  for (const a of anchors) {
    const href = a.getAttribute('href')
    if (href && !href.startsWith('javascript:')) {
      links.push({
        text: a.textContent?.trim() || '',
        href: href,
      })
    }
  }

  return {
    url: location.href,
    title: document.title,
    text: document.body?.innerText || '',
    links,
  }
}

export function executeJavaScript(code: string): unknown {
  // Use Function constructor to execute in page context
  try {
    const fn = new Function(code)
    return fn()
  } catch (error) {
    throw new Error(
      `JavaScript execution failed: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}

export function clickCoordinates(x: number, y: number): boolean {
  const el = document.elementFromPoint(x, y)
  if (!el) throw new Error(`No element found at coordinates (${x}, ${y})`)

  el.dispatchEvent(
    new MouseEvent('mouseover', { bubbles: true, clientX: x, clientY: y }),
  )
  el.dispatchEvent(
    new MouseEvent('mousedown', { bubbles: true, clientX: x, clientY: y }),
  )
  el.dispatchEvent(
    new MouseEvent('mouseup', { bubbles: true, clientX: x, clientY: y }),
  )
  el.dispatchEvent(
    new MouseEvent('click', { bubbles: true, clientX: x, clientY: y }),
  )
  return true
}

export function typeAtCoordinates(x: number, y: number, text: string): boolean {
  const el = document.elementFromPoint(x, y)
  if (!el) throw new Error(`No element found at coordinates (${x}, ${y})`)

  // Click first
  el.dispatchEvent(
    new MouseEvent('click', { bubbles: true, clientX: x, clientY: y }),
  )

  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    el.focus()
    el.value = text
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  } else if (
    el instanceof HTMLElement &&
    el.getAttribute('contenteditable') !== null
  ) {
    el.focus()
    el.textContent = text
    el.dispatchEvent(new Event('input', { bubbles: true }))
  } else {
    throw new Error(`Element at (${x}, ${y}) is not an input element`)
  }
  return true
}
