/* BrowserOS Profile Badge for Zen Browser
 *
 * Displays a profile badge in the nav-bar, before the URL input.
 * Shows: name + flag emoji + country code
 *
 * Reads config via ChromeUtils.camouGetString() from CAMOU_CONFIG env vars.
 *
 * Config keys:
 *   "profile.name"    - Display name (e.g., "shop01")
 *   "profile.color"   - Badge background color hex (e.g., "#4CAF50")
 *   "profile.ip"      - Proxy IP for tooltip (e.g., "203.0.113.42")
 *   "profile.country" - Country code for flag (e.g., "US")
 */

// biome-ignore lint/correctness/noUnusedVariables: loaded via Services.scriptloader.loadSubScript
var BrowserOSProfileBadge = {
  _initialized: false,

  init() {
    if (this._initialized) return
    this._initialized = true

    const name = ChromeUtils.camouGetString('profile.name')
    if (!name) return

    const color = ChromeUtils.camouGetString('profile.color') || '#2196F3'
    const ip = ChromeUtils.camouGetString('profile.ip') || ''
    const country = ChromeUtils.camouGetString('profile.country') || ''

    const textColor = this._shouldUseDarkText(color) ? '#1a1a1a' : '#ffffff'

    // Create badge element
    const badge = document.createXULElement('hbox')
    badge.id = 'browseros-profile-badge'
    badge.style.backgroundColor = color
    badge.style.color = textColor

    // Use HTML span for proper emoji/Unicode rendering
    const label = document.createElement('span')
    label.id = 'browseros-profile-label'
    let displayText = this._truncate(name, 12)
    if (country) {
      displayText += ` ${this._countryToFlag(country)} ${country}`
    }
    label.textContent = displayText
    badge.appendChild(label)

    // Tooltip with full info
    let tooltip = name
    if (ip) tooltip += ` | ${ip}`
    if (country) tooltip += ` | ${country}`
    badge.setAttribute('tooltiptext', tooltip)

    // Insert into nav-bar: before identity-box in the URL bar
    const identityBox = document.getElementById('identity-box')
    if (identityBox?.parentNode) {
      badge.setAttribute('urlbar-slot', 'site-info')
      identityBox.parentNode.insertBefore(badge, identityBox)
      ChromeUtils.camouDebug(
        'Profile badge inserted before identity-box in urlbar',
      )
    } else {
      // Fallback: insert before urlbar-container in nav-bar
      const urlbarContainer = document.getElementById('urlbar-container')
      if (urlbarContainer?.parentNode) {
        urlbarContainer.parentNode.insertBefore(badge, urlbarContainer)
        ChromeUtils.camouDebug('Profile badge inserted before urlbar-container')
      }
    }

    ChromeUtils.camouDebug(`Profile badge initialized: ${displayText}`)

    this._initWindowTitle(name)
  },

  _initWindowTitle(profileName) {
    const prefix = `[${profileName}] `
    const titleElem = document.querySelector('title')
    if (!titleElem) return

    const updateTitle = () => {
      const current = document.title
      if (current && !current.startsWith(prefix)) {
        document.title = prefix + current
      }
    }

    updateTitle()

    const observer = new MutationObserver(() => updateTitle())
    observer.observe(titleElem, { childList: true, characterData: true, subtree: true })

    // Also listen for tab switches that change the title
    window.addEventListener('pagetitlechanged', () => {
      requestAnimationFrame(updateTitle)
    })
  },

  _truncate(str, maxLen) {
    if (str.length <= maxLen) return str
    return `${str.substring(0, maxLen)}\u2026`
  },

  _countryToFlag(countryCode) {
    const code = countryCode.toUpperCase()
    if (code.length !== 2) return ''
    const offset = 0x1f1e6 - 65
    return String.fromCodePoint(
      code.charCodeAt(0) + offset,
      code.charCodeAt(1) + offset,
    )
  },

  _shouldUseDarkText(hexColor) {
    let hex = hexColor.replace('#', '')
    if (hex.length === 3) {
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2]
    }
    const r = parseInt(hex.substring(0, 2), 16)
    const g = parseInt(hex.substring(2, 4), 16)
    const b = parseInt(hex.substring(4, 6), 16)
    const luminance = 0.299 * r + 0.587 * g + 0.114 * b
    return luminance > 186.0
  },
}
