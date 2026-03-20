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
  // Helper Functions
  // ============================================================================

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
  // Navigator / Screen / Timezone — handled by C++ kernel
  // ============================================================================
  // navigator.platform, vendor, language, languages, hardwareConcurrency,
  // deviceMemory, userAgentData, appVersion, maxTouchPoints are handled by
  // C++ kernel patches. screen.* and devicePixelRatio are handled by C++
  // screen patches. Timezone (Date.getTimezoneOffset, Intl.*) is handled by
  // env.TZ set in launcher.ts — ICU/V8 natively use the correct timezone.
  //
  // Do NOT override any of these here — JS defineProperty creates own-property
  // arrow-function getters that detection sites flag as tampering.

  // ============================================================================
  // WebGL Timing Defense
  // ============================================================================
  // WebGL getParameter values are handled by C++ kernel, but the kernel returns
  // from cache (no GPU IPC), making getParameter ~20x faster than real Chrome.
  // Detection sites measure this throughput. We use a Proxy to inject delay
  // via crypto.getRandomValues() (a system call V8 JIT cannot optimize away).
  // The Proxy preserves the native toString() of getParameter.
  var _gpuDelayBuf = new Uint8Array(16)
  var _gpuDelayIters = 200
  ;(function calibrateGpuDelay() {
    let c, gl, ext, origGP, param
    try {
      c = document.createElement('canvas')
      gl = c.getContext('webgl')
      if (!gl) return
      ext = gl.getExtension('WEBGL_debug_renderer_info')
      if (!ext) return
      origGP = WebGLRenderingContext.prototype.getParameter
      param = ext.UNMASKED_RENDERER_WEBGL
      for (let attempt = 0; attempt < 6; attempt++) {
        let L = 0
        let b = performance.now()
        while (3 > performance.now() - b) {
          for (let j = 0; j < 10; j++) {
            for (let d = 0; d < _gpuDelayIters; d++)
              crypto.getRandomValues(_gpuDelayBuf)
            origGP.call(gl, param)
          }
          L += 10
        }
        b = performance.now() - b
        const Z = Math.round(L / b)
        if (Z > 80) _gpuDelayIters = Math.round(_gpuDelayIters * 1.5)
        else if (Z < 20)
          _gpuDelayIters = Math.max(10, Math.round(_gpuDelayIters * 0.6))
        else break
      }
    } catch (_e) {
      _gpuDelayIters = 200
    }
  })()

  // Proxy getParameter to inject timing delay while preserving native toString
  {
    const UNMASKED_VENDOR = 0x9245
    const UNMASKED_RENDERER = 0x9246
    const origGetParam = WebGLRenderingContext.prototype.getParameter
    WebGLRenderingContext.prototype.getParameter = new Proxy(origGetParam, {
      apply(target, thisArg, args) {
        const pname = args[0]
        if (pname === UNMASKED_VENDOR || pname === UNMASKED_RENDERER) {
          for (let _d = 0; _d < _gpuDelayIters; _d++)
            crypto.getRandomValues(_gpuDelayBuf)
        }
        return Reflect.apply(target, thisArg, args)
      },
    })
    if (typeof WebGL2RenderingContext !== 'undefined') {
      const origGetParam2 = WebGL2RenderingContext.prototype.getParameter
      WebGL2RenderingContext.prototype.getParameter = new Proxy(origGetParam2, {
        apply(target, thisArg, args) {
          const pname = args[0]
          if (pname === UNMASKED_VENDOR || pname === UNMASKED_RENDERER) {
            for (let _d = 0; _d < _gpuDelayIters; _d++)
              crypto.getRandomValues(_gpuDelayBuf)
          }
          return Reflect.apply(target, thisArg, args)
        },
      })
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
      document.fonts.check = spoofFunction(
        document.fonts.check,
        function check(font, text) {
          const fontFamily = font
            .replace(/^[\d.]+(?:px|pt|em|rem|%)\s+/, '')
            .replace(/["']/g, '')
            .trim()
          const isAllowed =
            allowedFonts.has(fontFamily) ||
            allowedFonts.has(fontFamily.toLowerCase()) ||
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
        },
        'check',
      )
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
      document.fonts.forEach = spoofFunction(
        document.fonts.forEach,
        function forEach(callback, thisArg) {
          originalForEach((fontFace, index, fonts) => {
            const family = fontFace.family.replace(/["']/g, '')
            if (allowedFonts.has(family) || allowedFonts.has(fontFace.family)) {
              callback.call(thisArg, fontFace, index, fonts)
            }
          }, thisArg)
        },
        'forEach',
      )
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
  // Plugins / MimeTypes — handled by Chrome natively
  // ============================================================================
  // Chrome 93+ hardcodes 5 PDF-related plugins for all users. JS overrides
  // create synthetic PluginArray objects with own-property getters that are
  // more detectable than the native implementation.

  // ============================================================================
  // MediaDevices — handled by C++ kernel
  // ============================================================================
  // enumerateDevices() is handled by C++ media_devices.cc.
  // getUserMedia WebRTC blocking is handled by C++ rtc_ice_candidate.cc.

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
    // Use Proxy on the prototype getters so that
    // Object.getOwnPropertyDescriptor still returns the original native getter
    // and toString() shows [native code].
    const connProto = Object.getPrototypeOf(navigator.connection)
    for (const [key, val] of Object.entries(connDefaults)) {
      try {
        const desc = Object.getOwnPropertyDescriptor(connProto, key)
        if (desc && desc.get) {
          const origGetter = desc.get
          const proxyGetter = new Proxy(origGetter, {
            apply() {
              return val
            },
          })
          Object.defineProperty(connProto, key, {
            ...desc,
            get: proxyGetter,
          })
        }
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
