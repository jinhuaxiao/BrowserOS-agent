/* BrowserOS Profile Badge for Camoufox
 *
 * Dynamically creates and displays a profile badge in the URL bar.
 * Reads config via ChromeUtils.camouGetString() from CAMOU_CONFIG env vars.
 *
 * Config keys:
 *   "profile.name"    - Display name (e.g., "amazon66")
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

    // Inject CSS
    const style = document.createElement('style')
    style.textContent = `
      #browseros-profile-badge {
        display: flex;
        align-items: center;
        height: 24px;
        padding: 0 10px;
        margin-inline-end: 4px;
        border-radius: 10px;
        font-family: system-ui, -apple-system, "Segoe UI", sans-serif,
          "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji";
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.02em;
        white-space: nowrap;
        cursor: default;
        transition: opacity 0.15s ease;
      }
      #browseros-profile-badge:hover {
        opacity: 0.85;
      }
      :root[uidensity="compact"] #browseros-profile-badge {
        height: 20px;
        padding: 0 8px;
        font-size: 10px;
      }
      :root[uidensity="touch"] #browseros-profile-badge {
        height: 28px;
        padding: 0 12px;
      }
    `
    document.head.appendChild(style)

    // Create badge element dynamically
    const badge = document.createXULElement('hbox')
    badge.id = 'browseros-profile-badge'
    badge.className = 'urlbar-icon-wrapper'

    // Use HTML <span> for proper emoji/Unicode rendering
    // (XUL <label value="..."> cannot render Regional Indicator emoji)
    const label = document.createElement('span')
    label.id = 'browseros-profile-label'
    let displayText = this._truncate(name, 12)
    if (country) {
      displayText += ` ${this._countryToFlag(country)} ${country}`
    }
    label.textContent = displayText
    badge.appendChild(label)

    // Apply colors
    badge.style.backgroundColor = color
    badge.style.color = this._shouldUseDarkText(color) ? '#1a1a1a' : '#ffffff'

    // Tooltip with full info
    let tooltip = name
    if (ip) tooltip += ` | ${ip}`
    if (country) tooltip += ` | ${country}`
    badge.setAttribute('tooltiptext', tooltip)

    // Insert into URL bar, before the identity box
    const identityBox = document.getElementById('identity-box')
    if (identityBox?.parentNode) {
      identityBox.parentNode.insertBefore(badge, identityBox)
    } else {
      // Fallback: insert into urlbar-input-container
      const urlbarContainer = document.getElementById('urlbar-input-container')
      if (urlbarContainer) {
        urlbarContainer.insertBefore(badge, urlbarContainer.firstChild)
      }
    }

    ChromeUtils.camouDebug(`Profile badge initialized: ${displayText}`)
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
