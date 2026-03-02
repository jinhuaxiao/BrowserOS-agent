/**
 * Fingerprint Injection Script
 *
 * Comprehensive fingerprint spoofing for anti-detection.
 * This script runs in the page context (MAIN world) at document_start.
 */

;(() => {
  const config = window.__FINGERPRINT_CONFIG__
  if (!config) return

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

    // UserAgentData override (Client Hints API)
    if (navigator.userAgentData && nav.platform) {
      const platformMap = {
        Win32: 'Windows',
        MacIntel: 'macOS',
        'Linux x86_64': 'Linux',
      }
      const platformName = platformMap[nav.platform] || nav.platform
      const fullMatch = nav.userAgent
        ? nav.userAgent.match(/Chrome\/([\d.]+)/)
        : null
      const chromeFullVersion = fullMatch ? fullMatch[1] : '142.0.7682.49'
      const chromeMajorVersion = chromeFullVersion.split('.')[0] || '142'

      const brandsLow = Object.freeze([
        Object.freeze({ brand: 'Google Chrome', version: chromeMajorVersion }),
        Object.freeze({ brand: 'Chromium', version: chromeMajorVersion }),
        Object.freeze({ brand: 'Not_A Brand', version: '24' }),
      ])
      const fullVersionList = Object.freeze([
        Object.freeze({ brand: 'Google Chrome', version: chromeFullVersion }),
        Object.freeze({ brand: 'Chromium', version: chromeFullVersion }),
        Object.freeze({ brand: 'Not_A Brand', version: '24.0.0.0' }),
      ])

      const fakeUAData = {
        brands: brandsLow,
        mobile: false,
        platform: platformName,
        getHighEntropyValues: (_hints) =>
          Promise.resolve({
            brands: brandsLow,
            mobile: false,
            platform: platformName,
            platformVersion: platformName === 'Windows' ? '10.0.0' : '10.15.7',
            architecture: 'x86',
            bitness: '64',
            model: '',
            uaFullVersion: chromeFullVersion,
            fullVersionList: fullVersionList,
          }),
        toJSON: function () {
          return {
            brands: this.brands,
            mobile: this.mobile,
            platform: this.platform,
          }
        },
      }
      Object.freeze(fakeUAData)
      defineProperty(navigator, 'userAgentData', fakeUAData)
    }
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
    const SpoofedDTF = (locales, options) => {
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
      const Spoofed = (locales, options) =>
        new Original(locales || configuredLanguage, options)
      Object.setPrototypeOf(Spoofed, Original)
      Spoofed.prototype = Original.prototype
      if (Original.supportedLocalesOf) {
        Spoofed.supportedLocalesOf = Original.supportedLocalesOf
      }
      Spoofed.toString = () => `function ${name}() { [native code] }`
      Intl[name] = Spoofed
    }
  })

  // ============================================================================
  // WebGL Overrides
  // ============================================================================

  if (config.webgl && !config.webgl.disableSpoofing) {
    const UNMASKED_VENDOR_WEBGL = 0x9245
    const UNMASKED_RENDERER_WEBGL = 0x9246

    const originalGetParameter = WebGLRenderingContext.prototype.getParameter
    WebGLRenderingContext.prototype.getParameter = spoofFunction(
      originalGetParameter,
      function (param) {
        if (param === UNMASKED_VENDOR_WEBGL)
          return config.webgl.unmaskedVendor || config.webgl.vendor
        if (param === UNMASKED_RENDERER_WEBGL)
          return config.webgl.unmaskedRenderer || config.webgl.renderer
        return originalGetParameter.call(this, param)
      },
      'getParameter',
    )

    if (typeof WebGL2RenderingContext !== 'undefined') {
      const originalGetParameter2 =
        WebGL2RenderingContext.prototype.getParameter
      WebGL2RenderingContext.prototype.getParameter = spoofFunction(
        originalGetParameter2,
        function (param) {
          if (param === UNMASKED_VENDOR_WEBGL)
            return config.webgl.unmaskedVendor || config.webgl.vendor
          if (param === UNMASKED_RENDERER_WEBGL)
            return config.webgl.unmaskedRenderer || config.webgl.renderer
          return originalGetParameter2.call(this, param)
        },
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
        toString: () => '[object MimeType]',
      }
      Object.defineProperty(mimeType, Symbol.toStringTag, { value: 'MimeType' })
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
        toString: () => '[object Plugin]',
      }

      const mimeTypes = Array.isArray(pluginData.mimeTypes)
        ? pluginData.mimeTypes
        : []
      mimeTypes.forEach((mime, index) => {
        plugin[index] = createMimeType(mime, plugin)
      })
      plugin.length = mimeTypes.length

      Object.defineProperty(plugin, Symbol.toStringTag, { value: 'Plugin' })
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
        toString: () => '[object PluginArray]',
      }

      pluginsData.forEach((pluginData, index) => {
        const plugin = createPlugin(pluginData)
        pluginArray[index] = plugin
        if (plugin.name) {
          pluginArray[plugin.name] = plugin
        }
      })
      pluginArray.length = pluginsData.length
      Object.defineProperty(pluginArray, Symbol.toStringTag, {
        value: 'PluginArray',
      })
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
        toString: () => '[object MimeTypeArray]',
      }

      mimeTypes.forEach((mime, index) => {
        mimeTypeArray[index] = mime
        if (mime.type) {
          mimeTypeArray[mime.type] = mime
        }
      })
      mimeTypeArray.length = mimeTypes.length
      Object.defineProperty(mimeTypeArray, Symbol.toStringTag, {
        value: 'MimeTypeArray',
      })
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
  // Cleanup
  // ============================================================================

  try {
    delete window.__FINGERPRINT_CONFIG__
  } catch (_e) {
    window.__FINGERPRINT_CONFIG__ = undefined
  }
})()
