// === BrowserOS Detection Test ===
// 在 DevTools Console 中运行，对比 BrowserOS vs 普通 Chrome

;(async () => {
  const r = {}

  // 1. navigator.webdriver
  r.webdriver = navigator.webdriver
  r.webdriverDescriptor = JSON.stringify(
    Object.getOwnPropertyDescriptor(Navigator.prototype, 'webdriver'),
  )

  // 2. Chrome automation
  r.domAutomation = !!window.domAutomation
  r.domAutomationController = !!window.domAutomationController
  r.cdc =
    Object.keys(window)
      .filter((k) => k.startsWith('cdc_') || k.startsWith('$cdc'))
      .join(',') || 'none'

  // 3. WebGL getParameter check
  try {
    const c = document.createElement('canvas')
    const gl = c.getContext('webgl')
    const origGP = WebGLRenderingContext.prototype.getParameter
    r.webglGetParamIsProxy = origGP.toString().includes('native code')
    r.webglGetParamIdentity = origGP === gl.getParameter
    const ext = gl.getExtension('WEBGL_debug_renderer_info')
    if (ext) {
      const t0 = performance.now()
      for (let i = 0; i < 100; i++) gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)
      r.webglTimingMs = (performance.now() - t0).toFixed(2)
      r.webglRenderer = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)
      r.webglVendor = gl.getParameter(ext.UNMASKED_VENDOR_WEBGL)
    }
  } catch (e) {
    r.webglError = e.message
  }

  // 4. RTCPeerConnection
  r.rtcExists = typeof RTCPeerConnection !== 'undefined'
  if (r.rtcExists) {
    r.rtcToString = RTCPeerConnection.toString().substring(0, 80)
    r.rtcIsNative = RTCPeerConnection.toString().includes('native code')
    r.rtcHasPrototype = !!RTCPeerConnection.prototype
    r.rtcCanNew = (() => {
      try {
        new RTCPeerConnection({ iceServers: [] })
        return true
      } catch (e) {
        return e.message
      }
    })()
  }

  // 5. navigator.connection
  if (navigator.connection) {
    const desc = Object.getOwnPropertyDescriptor(
      Object.getPrototypeOf(navigator.connection),
      'effectiveType',
    )
    r.connEffType = navigator.connection.effectiveType
    r.connRtt = navigator.connection.rtt
    r.connDownlink = navigator.connection.downlink
    r.connGetterIsProxy = desc?.get?.toString().includes('native code')
  }

  // 6. Extensions
  r.extensionAPIs =
    typeof chrome !== 'undefined' &&
    typeof chrome.runtime !== 'undefined' &&
    typeof chrome.runtime.id !== 'undefined'

  // 7. window properties check
  r.fpConfig = typeof window.__FINGERPRINT_CONFIG__
  r.browseros = typeof window.__BROWSEROS__

  // 8. navigator.plugins
  r.pluginCount = navigator.plugins.length
  r.pluginNames = Array.from(navigator.plugins)
    .map((p) => p.name)
    .join(', ')

  // 9. Sec-CH-UA via JS
  r.brands = navigator.userAgentData?.brands
    ?.map((b) => `${b.brand}/${b.version}`)
    .join(', ')
  r.mobile = navigator.userAgentData?.mobile
  r.platform = navigator.userAgentData?.platform

  // 10. High entropy hints
  try {
    const hi = await navigator.userAgentData?.getHighEntropyValues([
      'fullVersionList',
      'architecture',
      'bitness',
      'platformVersion',
      'model',
    ])
    r.fullVersionList = hi?.fullVersionList
      ?.map((b) => `${b.brand}/${b.version}`)
      .join(', ')
    r.arch = hi?.architecture
    r.bitness = hi?.bitness
    r.platformVersion = hi?.platformVersion
  } catch (e) {
    r.hintError = e.message
  }

  // 11. Screen
  r.screen = `${screen.width}x${screen.height} @${devicePixelRatio}x colorDepth=${screen.colorDepth}`

  // 12. Canvas fingerprint
  try {
    const cv = document.createElement('canvas')
    cv.width = 200
    cv.height = 50
    const ctx = cv.getContext('2d')
    ctx.textBaseline = 'top'
    ctx.font = '14px Arial'
    ctx.fillText('BrowserOS test', 2, 2)
    r.canvasHash = cv.toDataURL().length
  } catch (e) {
    r.canvasError = e.message
  }

  // 13. AudioContext fingerprint
  try {
    const actx = new (
      window.OfflineAudioContext || window.webkitOfflineAudioContext
    )(1, 44100, 44100)
    const osc = actx.createOscillator()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(10000, actx.currentTime)
    const comp = actx.createDynamicsCompressor()
    osc.connect(comp)
    comp.connect(actx.destination)
    osc.start(0)
    const buf = await actx.startRendering()
    const data = buf.getChannelData(0)
    r.audioSample = data
      .slice(4500, 4505)
      .map((v) => v.toFixed(10))
      .join(',')
  } catch (e) {
    r.audioError = e.message
  }

  // 14. Port scan test
  const portTest = async (port) => {
    try {
      const ctrl = new AbortController()
      setTimeout(() => ctrl.abort(), 500)
      await fetch(`http://127.0.0.1:${port}/json/version`, {
        signal: ctrl.signal,
        mode: 'no-cors',
      })
      return 'open'
    } catch (e) {
      return e.name === 'AbortError' ? 'timeout(likely open)' : 'closed'
    }
  }
  r.port9000 = await portTest(9000)
  r.port9100 = await portTest(9100)
  r.port9160 = await portTest(9160)
  r.port9222 = await portTest(9222)

  // 15. document.fonts
  r.fontsCheck = document.fonts.check('12px Arial')

  // Output
  console.table(r)
  console.log(JSON.stringify(r, null, 2))
})()
