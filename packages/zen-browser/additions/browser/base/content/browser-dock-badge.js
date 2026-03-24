/* BrowserOS Dock Icon Badge for Zen Browser (macOS only)
 *
 * Draws a circular profile badge on the macOS Dock icon,
 * matching the AdsPower-style badge from BrowserOS Chromium.
 *
 * Config keys (via ChromeUtils.camouGetString/camouGetInt):
 *   "profile.number"  - Serial number for dock badge (1, 2, 3...)
 *   "profile.name"    - Fallback display text if no number
 *   "profile.color"   - Badge background color hex (#RRGGBB)
 */

// biome-ignore lint/correctness/noUnusedVariables: loaded via Services.scriptloader.loadSubScript
var BrowserOSDockBadge = {
  _initialized: false,

  init() {
    if (this._initialized) return
    this._initialized = true

    if (Services.appinfo.OS !== 'Darwin') return

    const profileNumber = ChromeUtils.camouGetInt('profile.number')
    const profileName = ChromeUtils.camouGetString('profile.name')
    if (!profileNumber && !profileName) return

    const displayText = profileNumber > 0 ? String(profileNumber) : profileName
    if (!displayText) return

    const color = ChromeUtils.camouGetString('profile.color') || '#2196F3'

    try {
      this._setBadge(displayText, color)
      ChromeUtils.camouDebug(`Dock badge set: ${displayText}`)
    } catch (e) {
      ChromeUtils.camouDebug(`Dock badge failed: ${e}`)
    }
  },

  _setBadge(text, bgColor) {
    const size = 256
    const canvas = document.createElementNS('http://www.w3.org/1999/xhtml', 'canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')

    // Draw circular badge background
    const radius = size / 2
    ctx.beginPath()
    ctx.arc(radius, radius, radius, 0, Math.PI * 2)
    ctx.fillStyle = bgColor
    ctx.fill()

    // White border
    ctx.beginPath()
    ctx.arc(radius, radius, radius - 8, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'
    ctx.lineWidth = 10
    ctx.stroke()

    // Drop shadow (draw a slightly offset dark circle behind)
    // (Canvas doesn't do real drop shadows on arcs well, so we skip
    // and rely on the border for visual contrast)

    // Text
    const fontSize = text.length <= 2 ? size * 0.55 : size * 0.4
    ctx.font = `bold ${fontSize}px -apple-system, system-ui, sans-serif`
    ctx.fillStyle = '#ffffff'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, radius, radius + fontSize * 0.05)

    // Convert canvas to blob, then to imgIContainer, then set as dock badge
    canvas.toBlob(blob => {
      if (!blob) return
      const reader = new FileReader()
      reader.onload = () => {
        try {
          const buffer = reader.result
          const imgTools = Cc['@mozilla.org/image/tools;1'].getService(Ci.imgITools)
          const container = imgTools.decodeImageFromArrayBuffer(buffer, 'image/png')
          const dockSupport = Cc['@mozilla.org/widget/macdocksupport;1'].getService(Ci.nsIMacDockSupport)
          dockSupport.setBadgeImage(container)
        } catch (e) {
          ChromeUtils.camouDebug(`Dock badge image conversion failed: ${e}`)
        }
      }
      reader.readAsArrayBuffer(blob)
    }, 'image/png')
  },
}
