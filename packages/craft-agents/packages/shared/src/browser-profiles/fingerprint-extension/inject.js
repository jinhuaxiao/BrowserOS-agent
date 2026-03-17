/**
 * Fingerprint Injection Script
 *
 * Comprehensive fingerprint spoofing for anti-detection.
 * This script runs in the page context (MAIN world) at document_start.
 */

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: fingerprint injection requires many API overrides in single IIFE
;(() => {
  const config = window.__FINGERPRINT_CONFIG__
  if (!config) return

  // ============================================================================
  // WebGL timing calibration
  // ============================================================================
  // BrowserOS C++ kernel returns WebGL data from cache (no GPU IPC), making
  // getParameter ~20x faster than real Chrome. Detection sites measure this
  // throughput (threshold: ≤100 ops/ms). Use crypto.getRandomValues() as delay.
  // V8 JIT makes crypto ~50x faster in hot loops vs cold calibration, so we
  // self-calibrate by measuring actual Z on a live WebGL context.
  var _gpuDelayBuf = new Uint8Array(16)
  var _gpuDelayIters = 200
  var _gpuParamCache = new Map()
  ;(function calibrateGpuDelay() {
    let c, gl, ext, origGP, param, attempt, L, b, Z, j, d
    try {
      c = document.createElement('canvas')
      gl = c.getContext('webgl')
      if (!gl) return
      ext = gl.getExtension('WEBGL_debug_renderer_info')
      if (!ext) return
      origGP = WebGLRenderingContext.prototype.getParameter
      param = ext.UNMASKED_RENDERER_WEBGL
      // Iteratively adjust _gpuDelayIters until Z is in [30, 80]
      for (attempt = 0; attempt < 4; attempt++) {
        L = 0
        b = performance.now()
        while (3 > performance.now() - b) {
          for (j = 0; j < 10; j++) {
            for (d = 0; d < _gpuDelayIters; d++)
              crypto.getRandomValues(_gpuDelayBuf)
            origGP.call(gl, param)
          }
          L += 10
        }
        b = performance.now() - b
        Z = Math.round(L / b)
        if (Z > 80) _gpuDelayIters = Math.round(_gpuDelayIters * 1.5)
        else if (Z < 20)
          _gpuDelayIters = Math.max(10, Math.round(_gpuDelayIters * 0.6))
        else break
      }
    } catch (_e) {
      _gpuDelayIters = 200
    }
  })()

  // ============================================================================
  // Helper Functions
  // ============================================================================

  function defineProperty(obj, prop, value) {
    try {
      Object.defineProperty(obj, prop, {
        get: () => value,
        configurable: true,
        enumerable: true,
      })
    } catch (_e) {}
  }

  // Spoof function to hide tampering from toString() detection
  function spoofFunction(originalFunc, handler, name) {
    const spoofed = function (...args) {
      return handler.apply(this, args)
    }
    spoofed.toString = () =>
      `function ${name || originalFunc.name || ''}() { [native code] }`
    Object.defineProperty(spoofed, 'name', {
      value: name || originalFunc.name,
      configurable: true,
    })
    Object.defineProperty(spoofed, 'length', {
      value: originalFunc.length,
      configurable: true,
    })
    return spoofed
  }

  // ============================================================================
  // Navigator Overrides (Platform, Language, Hardware)
  // ============================================================================

  if (config.navigator) {
    const nav = config.navigator

    // Core properties
    if (nav.platform) defineProperty(navigator, 'platform', nav.platform)
    if (nav.vendor) defineProperty(navigator, 'vendor', nav.vendor)
    if (nav.language) defineProperty(navigator, 'language', nav.language)
    if (nav.languages)
      defineProperty(navigator, 'languages', Object.freeze([...nav.languages]))
    if (nav.appVersion) defineProperty(navigator, 'appVersion', nav.appVersion)
    if (nav.maxTouchPoints !== undefined)
      defineProperty(navigator, 'maxTouchPoints', nav.maxTouchPoints)

    // Hardware properties
    if (nav.hardwareConcurrency)
      defineProperty(navigator, 'hardwareConcurrency', nav.hardwareConcurrency)
    if (nav.deviceMemory)
      defineProperty(navigator, 'deviceMemory', nav.deviceMemory)

    // UserAgentData (Client Hints API) — handled by BrowserOS C++ patches in
    // user_agent_utils.cc which generate correct GREASE brands, shuffle order,
    // and high-entropy values consistent with HTTP Sec-CH-UA headers.
    // Do NOT override navigator.userAgentData here — it causes mismatches
    // between HTTP headers (C++ generated) and JS API (inject.js hardcoded).
  }

  // ============================================================================
  // Screen Overrides
  // ============================================================================

  if (config.screen) {
    const scr = config.screen
    if (scr.width) defineProperty(screen, 'width', scr.width)
    if (scr.height) defineProperty(screen, 'height', scr.height)
    if (scr.availWidth) defineProperty(screen, 'availWidth', scr.availWidth)
    if (scr.availHeight) defineProperty(screen, 'availHeight', scr.availHeight)
    if (scr.colorDepth) defineProperty(screen, 'colorDepth', scr.colorDepth)
    if (scr.pixelDepth) defineProperty(screen, 'pixelDepth', scr.pixelDepth)
    if (scr.devicePixelRatio)
      defineProperty(window, 'devicePixelRatio', scr.devicePixelRatio)
  }

  // ============================================================================
  // Timezone Override
  // ============================================================================

  const configuredLanguage = config.navigator?.language || 'en-US'

  if (config.timezone?.name) {
    const tzName = config.timezone.name
    const tzOffset = config.timezone.offset || 0

    // Override Intl.DateTimeFormat for timezone AND locale
    const originalDateTimeFormat = Intl.DateTimeFormat
    function SpoofedDTF(locales, options) {
      const effectiveLocales = locales || configuredLanguage
      const newOptions = { ...options }
      if (!newOptions.timeZone) {
        newOptions.timeZone = tzName
      }
      return new originalDateTimeFormat(effectiveLocales, newOptions)
    }
    Object.setPrototypeOf(SpoofedDTF, originalDateTimeFormat)
    SpoofedDTF.prototype = originalDateTimeFormat.prototype
    SpoofedDTF.supportedLocalesOf = originalDateTimeFormat.supportedLocalesOf
    SpoofedDTF.toString = () => 'function DateTimeFormat() { [native code] }'
    Intl.DateTimeFormat = SpoofedDTF

    // Override Date.prototype.getTimezoneOffset
    Date.prototype.getTimezoneOffset = () => tzOffset
  }

  // Override other Intl APIs for locale consistency
  const intlConstructors = [
    'NumberFormat',
    'Collator',
    'PluralRules',
    'RelativeTimeFormat',
    'ListFormat',
    'DisplayNames',
    'Segmenter',
  ]

  intlConstructors.forEach((name) => {
    if (typeof Intl[name] !== 'undefined') {
      const Original = Intl[name]
      // Use Proxy to intercept both `new Intl.X()` and `Intl.X()` calls,
      // injecting the configured locale as the default.
      Intl[name] = new Proxy(Original, {
        construct(target, args) {
          const [locales, options] = args
          return new target(locales || configuredLanguage, options)
        },
        apply(target, thisArg, args) {
          const [locales, options] = args
          return new target(locales || configuredLanguage, options)
        },
      })
    }
  })

  // ============================================================================
  // WebGL Overrides
  // ============================================================================

  if (config.webgl && !config.webgl.disableSpoofing) {
    const GL_VENDOR = 0x1f00
    const GL_RENDERER = 0x1f01
    const GL_VERSION = 0x1f02
    const GL_SHADING_LANGUAGE_VERSION = 0x8b8c
    const UNMASKED_VENDOR_WEBGL = 0x9245
    const UNMASKED_RENDERER_WEBGL = 0x9246

    function webglGetParameterHandler(originalFn, isWebGL2) {
      const cacheKey = isWebGL2 ? 'gl2_' : 'gl1_'
      // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: WebGL param handler needs all branches
      return function (param) {
        // Always execute delay for UNMASKED params to preserve consistent timing
        if (
          param === UNMASKED_VENDOR_WEBGL ||
          param === UNMASKED_RENDERER_WEBGL
        ) {
          for (let _d = 0; _d < _gpuDelayIters; _d++)
            crypto.getRandomValues(_gpuDelayBuf)
          const ukey = cacheKey + param
          if (_gpuParamCache.has(ukey)) return _gpuParamCache.get(ukey)
          const uresult =
            param === UNMASKED_VENDOR_WEBGL
              ? config.webgl.unmaskedVendor || config.webgl.vendor
              : config.webgl.unmaskedRenderer || config.webgl.renderer
          _gpuParamCache.set(ukey, uresult)
          return uresult
        }
        const key = cacheKey + param
        if (_gpuParamCache.has(key)) return _gpuParamCache.get(key)
        let result
        if (param === GL_VENDOR) {
          result = config.webgl.vendor || 'WebKit'
        } else if (param === GL_RENDERER) {
          result = config.webgl.renderer || 'WebKit WebGL'
        } else if (param === GL_VERSION) {
          const inner = isWebGL2
            ? config.webgl.glVersion2 || 'OpenGL ES 3.0 Chromium'
            : config.webgl.glVersion || 'OpenGL ES 2.0 Chromium'
          result = isWebGL2 ? `WebGL 2.0 (${inner})` : `WebGL 1.0 (${inner})`
        } else if (param === GL_SHADING_LANGUAGE_VERSION) {
          const inner = isWebGL2
            ? config.webgl.shadingLanguageVersion2 ||
              'OpenGL ES GLSL ES 3.0 Chromium'
            : config.webgl.shadingLanguageVersion ||
              'OpenGL ES GLSL ES 1.0 Chromium'
          result = isWebGL2
            ? `WebGL GLSL ES 3.00 (${inner})`
            : `WebGL GLSL ES 1.0 (${inner})`
        } else {
          return originalFn.call(this, param)
        }
        _gpuParamCache.set(key, result)
        return result
      }
    }

    const originalGetParameter = WebGLRenderingContext.prototype.getParameter
    WebGLRenderingContext.prototype.getParameter = spoofFunction(
      originalGetParameter,
      webglGetParameterHandler(originalGetParameter, false),
      'getParameter',
    )

    if (typeof WebGL2RenderingContext !== 'undefined') {
      const originalGetParameter2 =
        WebGL2RenderingContext.prototype.getParameter
      WebGL2RenderingContext.prototype.getParameter = spoofFunction(
        originalGetParameter2,
        webglGetParameterHandler(originalGetParameter2, true),
        'getParameter',
      )
    }
  }

  // ============================================================================
  // Font Fingerprint Protection
  // ============================================================================

  if (config.fonts) {
    const allowedFonts = new Set(config.fonts.enabledFonts || [])

    // Override document.fonts.check() to only return true for allowed fonts
    if (document.fonts?.check) {
      const originalCheck = document.fonts.check.bind(document.fonts)
      document.fonts.check = (font, text) => {
        // Extract font family from font string (e.g., "12px Arial" -> "Arial")
        const fontFamily = font
          .replace(/^[\d.]+(?:px|pt|em|rem|%)\s+/, '')
          .replace(/["']/g, '')
          .trim()

        // Check if the font family is in our allowed list
        const isAllowed =
          allowedFonts.has(fontFamily) ||
          allowedFonts.has(fontFamily.toLowerCase()) ||
          // Check for generic font families
          [
            'serif',
            'sans-serif',
            'monospace',
            'cursive',
            'fantasy',
            'system-ui',
          ].includes(fontFamily.toLowerCase())

        if (!isAllowed) {
          return false
        }
        return originalCheck(font, text)
      }
    }

    // Override document.fonts iteration to only return allowed fonts
    if (
      document.fonts &&
      typeof document.fonts[Symbol.iterator] === 'function'
    ) {
      const originalIterator = document.fonts[Symbol.iterator].bind(
        document.fonts,
      )
      document.fonts[Symbol.iterator] = function* () {
        for (const fontFace of originalIterator()) {
          if (
            allowedFonts.has(fontFace.family) ||
            allowedFonts.has(fontFace.family.replace(/["']/g, ''))
          ) {
            yield fontFace
          }
        }
      }
    }

    // Override document.fonts.forEach
    if (document.fonts?.forEach) {
      const originalForEach = document.fonts.forEach.bind(document.fonts)
      document.fonts.forEach = (callback, thisArg) => {
        originalForEach((fontFace, index, fonts) => {
          const family = fontFace.family.replace(/["']/g, '')
          if (allowedFonts.has(family) || allowedFonts.has(fontFace.family)) {
            callback.call(thisArg, fontFace, index, fonts)
          }
        }, thisArg)
      }
    }

    // Block font enumeration if configured
    if (config.fonts.blockFontEnumeration) {
      try {
        Object.defineProperty(document.fonts, 'size', {
          get: () => allowedFonts.size,
          configurable: true,
        })
      } catch (_e) {}
    }
  }

  // ============================================================================
  // Plugins / MimeTypes Overrides
  // ============================================================================

  if (config.plugins && Array.isArray(config.plugins.items)) {
    function createMimeType(mime, plugin) {
      const mimeType = {
        type: mime.type || '',
        description: mime.description || '',
        suffixes: mime.suffixes || '',
        enabledPlugin: plugin,
      }
      if (typeof MimeType !== 'undefined') {
        Object.setPrototypeOf(mimeType, MimeType.prototype)
      } else {
        Object.defineProperty(mimeType, Symbol.toStringTag, {
          value: 'MimeType',
        })
      }
      return mimeType
    }

    function createPlugin(pluginData) {
      const plugin = {
        name: pluginData.name || '',
        description: pluginData.description || '',
        filename: pluginData.filename || '',
        length: 0,
        item: function (index) {
          return this[index] || null
        },
        namedItem: function (name) {
          for (let i = 0; i < this.length; i++) {
            if (this[i] && this[i].type === name) return this[i]
          }
          return null
        },
      }

      const mimeTypes = Array.isArray(pluginData.mimeTypes)
        ? pluginData.mimeTypes
        : []
      mimeTypes.forEach((mime, index) => {
        plugin[index] = createMimeType(mime, plugin)
      })
      plugin.length = mimeTypes.length

      if (typeof Plugin !== 'undefined') {
        Object.setPrototypeOf(plugin, Plugin.prototype)
      } else {
        Object.defineProperty(plugin, Symbol.toStringTag, { value: 'Plugin' })
      }
      return plugin
    }

    function createPluginArray(pluginsData) {
      const pluginArray = {
        length: 0,
        item: function (index) {
          return this[index] || null
        },
        namedItem: function (name) {
          for (let i = 0; i < this.length; i++) {
            if (this[i] && this[i].name === name) return this[i]
          }
          return null
        },
        refresh: () => {},
      }

      pluginsData.forEach((pluginData, index) => {
        const plugin = createPlugin(pluginData)
        pluginArray[index] = plugin
        if (plugin.name) {
          pluginArray[plugin.name] = plugin
        }
      })
      pluginArray.length = pluginsData.length
      if (typeof PluginArray !== 'undefined') {
        Object.setPrototypeOf(pluginArray, PluginArray.prototype)
      } else {
        Object.defineProperty(pluginArray, Symbol.toStringTag, {
          value: 'PluginArray',
        })
      }
      return pluginArray
    }

    function createMimeTypeArray(pluginsData, pluginArray) {
      const mimeTypes = []
      pluginsData.forEach((pluginData, pluginIndex) => {
        const plugin = pluginArray[pluginIndex]
        const mimeList = Array.isArray(pluginData.mimeTypes)
          ? pluginData.mimeTypes
          : []
        mimeList.forEach((mime) => {
          if (plugin) {
            mimeTypes.push(createMimeType(mime, plugin))
          }
        })
      })

      const mimeTypeArray = {
        length: 0,
        item: function (index) {
          return this[index] || null
        },
        namedItem: function (name) {
          for (let i = 0; i < this.length; i++) {
            if (this[i] && this[i].type === name) return this[i]
          }
          return null
        },
      }

      mimeTypes.forEach((mime, index) => {
        mimeTypeArray[index] = mime
        if (mime.type) {
          mimeTypeArray[mime.type] = mime
        }
      })
      mimeTypeArray.length = mimeTypes.length
      if (typeof MimeTypeArray !== 'undefined') {
        Object.setPrototypeOf(mimeTypeArray, MimeTypeArray.prototype)
      } else {
        Object.defineProperty(mimeTypeArray, Symbol.toStringTag, {
          value: 'MimeTypeArray',
        })
      }
      return mimeTypeArray
    }

    const pluginArray = createPluginArray(config.plugins.items)
    const mimeTypeArray = createMimeTypeArray(config.plugins.items, pluginArray)
    defineProperty(navigator, 'plugins', pluginArray)
    defineProperty(navigator, 'mimeTypes', mimeTypeArray)
  }

  // ============================================================================
  // MediaDevices Overrides
  // ============================================================================

  if (config.mediaDevices && navigator.mediaDevices) {
    const devices = Array.isArray(config.mediaDevices.devices)
      ? config.mediaDevices.devices
      : []
    let hasGumAccess = false

    if (navigator.mediaDevices.getUserMedia) {
      const originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(
        navigator.mediaDevices,
      )
      navigator.mediaDevices.getUserMedia = (constraints) => {
        if (config.webrtc?.disableWebRTC) {
          return Promise.reject(
            new DOMException('WebRTC is disabled.', 'NotAllowedError'),
          )
        }
        return originalGetUserMedia(constraints).then((stream) => {
          hasGumAccess = true
          return stream
        })
      }
    }

    if (navigator.mediaDevices.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices = () => {
        if (config.webrtc?.disableWebRTC) {
          return Promise.resolve([])
        }
        const mapped = devices.map((device) => {
          const allowLabels = hasGumAccess
          return {
            kind: device.kind,
            deviceId: device.deviceId || '',
            label: allowLabels ? device.label || '' : '',
            groupId: allowLabels ? device.groupId || '' : '',
            toJSON: function () {
              return {
                kind: this.kind,
                deviceId: this.deviceId,
                label: this.label,
                groupId: this.groupId,
              }
            },
          }
        })
        return Promise.resolve(mapped)
      }
    }
  }

  // ============================================================================
  // WebRTC IP Leak Prevention
  // ============================================================================

  if (config.webrtc?.disableWebRTC) {
    if (typeof RTCPeerConnection !== 'undefined') {
      const OriginalRTC = RTCPeerConnection
      window.RTCPeerConnection = (config, constraints) => {
        const modifiedConfig = { ...config, iceServers: [] }
        const pc = new OriginalRTC(modifiedConfig, constraints)
        const originalCreateOffer = pc.createOffer.bind(pc)
        pc.createOffer = (options) =>
          originalCreateOffer(options).then((offer) => {
            offer.sdp = offer.sdp.replace(/a=candidate:.*/g, '')
            return offer
          })
        return pc
      }
      window.RTCPeerConnection.prototype = OriginalRTC.prototype
    }
    if (typeof webkitRTCPeerConnection !== 'undefined') {
      window.webkitRTCPeerConnection = window.RTCPeerConnection
    }
  }

  // ============================================================================
  // Navigator.connection (NetworkInformation API)
  // ============================================================================

  if (navigator.connection) {
    const connDefaults = {
      effectiveType: '4g',
      rtt: 50,
      downlink: 10,
      saveData: false,
    }
    for (const [key, val] of Object.entries(connDefaults)) {
      try {
        Object.defineProperty(navigator.connection, key, {
          get: () => val,
          configurable: true,
          enumerable: true,
        })
      } catch (_e) {}
    }
  }

  // ============================================================================
  // Web Share API Stub (Desktop Chrome 89+)
  // ============================================================================

  if (typeof navigator.share === 'undefined') {
    Object.defineProperty(navigator, 'share', {
      value: spoofFunction(
        function share() {},
        function share(_data) {
          return Promise.reject(
            new DOMException(
              "Failed to execute 'share' on 'Navigator': Must be handling a user gesture to perform a share request.",
              'NotAllowedError',
            ),
          )
        },
        'share',
      ),
      writable: true,
      configurable: true,
      enumerable: true,
    })
  }
  if (typeof navigator.canShare === 'undefined') {
    Object.defineProperty(navigator, 'canShare', {
      value: spoofFunction(
        function canShare() {},
        function canShare(data) {
          if (!data || typeof data !== 'object') return false
          return !!(data.url || data.text || data.title || data.files)
        },
        'canShare',
      ),
      writable: true,
      configurable: true,
      enumerable: true,
    })
  }

  // ============================================================================
  // Mobile-Only API Stubs (Android Chrome)
  // ============================================================================

  if (config.deviceType === 'mobile') {
    // ContactsManager API (navigator.contacts)
    if (typeof navigator.contacts === 'undefined') {
      const contactsManager = {}
      Object.defineProperty(contactsManager, 'select', {
        value: spoofFunction(
          function select() {},
          function select(_properties, _options) {
            return Promise.reject(
              new DOMException(
                "Failed to execute 'select' on 'ContactsManager': A user gesture is required to call this method.",
                'InvalidStateError',
              ),
            )
          },
          'select',
        ),
        writable: true,
        configurable: true,
        enumerable: true,
      })
      Object.defineProperty(contactsManager, 'getProperties', {
        value: spoofFunction(
          function getProperties() {},
          function getProperties() {
            return Promise.resolve(['name', 'email', 'tel', 'address', 'icon'])
          },
          'getProperties',
        ),
        writable: true,
        configurable: true,
        enumerable: true,
      })
      Object.defineProperty(contactsManager, Symbol.toStringTag, {
        value: 'ContactsManager',
      })
      Object.defineProperty(navigator, 'contacts', {
        value: contactsManager,
        writable: true,
        configurable: true,
        enumerable: true,
      })
    }

    // ContentIndex API (window.ContentIndex)
    if (typeof window.ContentIndex === 'undefined') {
      function ContentIndex() {
        throw new TypeError('Illegal constructor')
      }
      ContentIndex.prototype.add = spoofFunction(
        function add() {},
        function add(_description) {
          return Promise.reject(
            new DOMException(
              "Failed to execute 'add' on 'ContentIndex': Not implemented.",
              'InvalidStateError',
            ),
          )
        },
        'add',
      )
      ContentIndex.prototype.delete = spoofFunction(
        function _delete() {},
        function _delete(_id) {
          return Promise.resolve()
        },
        'delete',
      )
      ContentIndex.prototype.getAll = spoofFunction(
        function getAll() {},
        function getAll() {
          return Promise.resolve([])
        },
        'getAll',
      )
      Object.defineProperty(ContentIndex.prototype, Symbol.toStringTag, {
        value: 'ContentIndex',
      })
      window.ContentIndex = ContentIndex
    }

    // NetworkInformation.downlinkMax (Android only)
    if (
      typeof navigator.connection !== 'undefined' &&
      !('downlinkMax' in navigator.connection)
    ) {
      Object.defineProperty(navigator.connection, 'downlinkMax', {
        get: () => Infinity,
        configurable: true,
        enumerable: true,
      })
    }
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  try {
    delete window.__FINGERPRINT_CONFIG__
  } catch (_e) {
    window.__FINGERPRINT_CONFIG__ = undefined
  }
})()
