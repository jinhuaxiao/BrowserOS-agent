/**
 * Fingerprint Extension Builder
 *
 * Dynamically builds a Chrome extension that injects fingerprint overrides
 * into web pages. The extension is built per-profile with embedded configuration.
 */

import { execSync } from 'node:child_process'
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'
import type { FingerprintConfig } from './types.ts'

const FINGERPRINT_MV2_EXT_ID = 'fingerprint-guard@browseros.io'

// Resolve the extension template directory.
// Uses multiple paths to support both development and bundled environments:
// - Development (Bun): __dirname = packages/shared/src/browser-profiles/
// - Packaged (esbuild CJS): __dirname = <app-bundle>/dist/
function getTemplateDir(): string {
  const defaultTemplateDir = join(__dirname, 'fingerprint-extension')
  const possiblePaths = [
    // 1. __dirname relative: development environment
    defaultTemplateDir,
    // 2. Fallback: process.cwd() for monorepo root in dev
    join(
      process.cwd(),
      'packages',
      'shared',
      'src',
      'browser-profiles',
      'fingerprint-extension',
    ),
  ]

  for (const p of possiblePaths) {
    if (existsSync(p)) {
      return p
    }
  }

  // Return first path as fallback (minimal inject script will be used)
  return possiblePaths[0] ?? defaultTemplateDir
}

/**
 * Get the path to the fingerprint extension directory for a profile
 */
export function getExtensionPath(profileDir: string): string {
  return join(profileDir, 'fingerprint-extension')
}

/**
 * Build the fingerprint injection extension for a profile
 *
 * Creates a Chrome extension in the profile directory that will override
 * browser fingerprint APIs to match the configured values.
 *
 * @param fingerprintConfig - The fingerprint configuration to embed
 * @param profileDir - The profile directory path
 * @returns Path to the built extension directory
 */
export async function buildFingerprintExtension(
  fingerprintConfig: FingerprintConfig,
  profileDir: string,
): Promise<string> {
  const extensionDir = getExtensionPath(profileDir)

  // Create extension directory
  if (!existsSync(extensionDir)) {
    mkdirSync(extensionDir, { recursive: true })
  }

  // Copy manifest.json from template
  const templateDir = getTemplateDir()
  const manifestTemplatePath = join(templateDir, 'manifest.json')
  const manifestOutputPath = join(extensionDir, 'manifest.json')

  if (existsSync(manifestTemplatePath)) {
    cpSync(manifestTemplatePath, manifestOutputPath)
  } else {
    // Create manifest if template doesn't exist
    const manifest = {
      manifest_version: 3,
      name: 'Fingerprint Guard',
      version: '1.0.0',
      description: 'Browser fingerprint protection for anti-detection',
      permissions: [],
      content_scripts: [
        {
          matches: ['<all_urls>'],
          js: ['inject.js'],
          run_at: 'document_start',
          all_frames: true,
          world: 'MAIN',
        },
      ],
    }
    writeFileSync(manifestOutputPath, JSON.stringify(manifest, null, 2))
  }

  // Read inject.js template
  const injectTemplatePath = join(templateDir, 'inject.js')
  let injectScript: string

  if (existsSync(injectTemplatePath)) {
    injectScript = readFileSync(injectTemplatePath, 'utf-8')
  } else {
    // Use minimal fallback if template doesn't exist
    injectScript = createMinimalInjectScript()
  }

  // Embed the fingerprint configuration into the script
  const configJson = JSON.stringify(fingerprintConfig, null, 2)
  const configInjection = `window.__FINGERPRINT_CONFIG__ = ${configJson};\n\n`

  // Prepend the configuration to the script
  const finalScript = configInjection + injectScript

  // Write the final inject.js
  const injectOutputPath = join(extensionDir, 'inject.js')
  writeFileSync(injectOutputPath, finalScript)

  return extensionDir
}

/**
 * Check if a fingerprint extension exists for a profile
 */
export function hasExtension(profileDir: string): boolean {
  const extensionDir = getExtensionPath(profileDir)
  const manifestPath = join(extensionDir, 'manifest.json')
  const injectPath = join(extensionDir, 'inject.js')

  return existsSync(manifestPath) && existsSync(injectPath)
}

/**
 * Create a minimal inject script as fallback
 * Used when the template file is not available
 */
function createMinimalInjectScript(): string {
  return `
/**
 * Fingerprint Injection Script (Minimal Fallback)
 */
(function() {
  'use strict';

  const config = window.__FINGERPRINT_CONFIG__;
  if (!config) return;

  function defineProperty(obj, prop, value) {
    try {
      Object.defineProperty(obj, prop, {
        get: () => value,
        configurable: true,
        enumerable: true
      });
    } catch (e) {}
  }

  // Spoof function to hide tampering from toString() detection
  function spoofFunction(originalFunc, handler, name) {
    const spoofed = function(...args) {
      return handler.apply(this, args);
    };
    spoofed.toString = function() {
      return 'function ' + (name || originalFunc.name || '') + '() { [native code] }';
    };
    Object.defineProperty(spoofed, 'name', { value: name || originalFunc.name, configurable: true });
    Object.defineProperty(spoofed, 'length', { value: originalFunc.length, configurable: true });
    return spoofed;
  }

  // Navigator overrides
  if (config.navigator) {
    const nav = config.navigator;
    if (nav.platform) defineProperty(navigator, 'platform', nav.platform);
    if (nav.vendor) defineProperty(navigator, 'vendor', nav.vendor);
    if (nav.hardwareConcurrency) defineProperty(navigator, 'hardwareConcurrency', nav.hardwareConcurrency);
    if (nav.deviceMemory) defineProperty(navigator, 'deviceMemory', nav.deviceMemory);
    if (nav.languages) defineProperty(navigator, 'languages', Object.freeze([...nav.languages]));
    if (nav.language) defineProperty(navigator, 'language', nav.language);
    if (nav.maxTouchPoints !== undefined) defineProperty(navigator, 'maxTouchPoints', nav.maxTouchPoints);
    if (nav.appVersion) defineProperty(navigator, 'appVersion', nav.appVersion);

    // UserAgentData (Client Hints API) — handled by BrowserOS C++ patches.
    // Do NOT override here to avoid mismatches with HTTP Sec-CH-UA headers.
  }

  // Screen overrides
  if (config.screen) {
    const scr = config.screen;
    if (scr.width) defineProperty(screen, 'width', scr.width);
    if (scr.height) defineProperty(screen, 'height', scr.height);
    if (scr.availWidth) defineProperty(screen, 'availWidth', scr.availWidth);
    if (scr.availHeight) defineProperty(screen, 'availHeight', scr.availHeight);
    if (scr.colorDepth) defineProperty(screen, 'colorDepth', scr.colorDepth);
    if (scr.pixelDepth) defineProperty(screen, 'pixelDepth', scr.pixelDepth);
    if (scr.devicePixelRatio) defineProperty(window, 'devicePixelRatio', scr.devicePixelRatio);
  }

  // WebGL overrides with timing defense (self-calibrating)
  var _gpuDelayBuf = new Uint8Array(16);
  var _gpuDelayIters = 200;
  (function() {
    try {
      var c = document.createElement('canvas');
      var gl = c.getContext('webgl');
      if (!gl) return;
      var ext = gl.getExtension('WEBGL_debug_renderer_info');
      if (!ext) return;
      var origGP = WebGLRenderingContext.prototype.getParameter;
      var param = ext.UNMASKED_RENDERER_WEBGL;
      for (var attempt = 0; attempt < 6; attempt++) {
        var L = 0, b = performance.now();
        while (3 > performance.now() - b) {
          for (var j = 0; j < 10; j++) {
            for (var d = 0; d < _gpuDelayIters; d++) crypto.getRandomValues(_gpuDelayBuf);
            origGP.call(gl, param);
          }
          L += 10;
        }
        b = performance.now() - b;
        var Z = Math.round(L / b);
        if (Z > 80) _gpuDelayIters = Math.round(_gpuDelayIters * 1.5);
        else if (Z < 20) _gpuDelayIters = Math.max(10, Math.round(_gpuDelayIters * 0.6));
        else break;
      }
    } catch(e) { _gpuDelayIters = 200; }
  })();

  if (config.webgl) {
    const GL_VENDOR = 0x1F00;
    const GL_RENDERER = 0x1F01;
    const UNMASKED_VENDOR_WEBGL = 0x9245;
    const UNMASKED_RENDERER_WEBGL = 0x9246;
    function webglHandler(originalFn) {
      return function(param) {
        if (param === GL_VENDOR) return config.webgl.vendor || 'WebKit';
        if (param === GL_RENDERER) return config.webgl.renderer || 'WebKit WebGL';
        if (param === UNMASKED_VENDOR_WEBGL || param === UNMASKED_RENDERER_WEBGL) {
          for (var _d = 0; _d < _gpuDelayIters; _d++) crypto.getRandomValues(_gpuDelayBuf);
          return param === UNMASKED_VENDOR_WEBGL
            ? config.webgl.unmaskedVendor || config.webgl.vendor
            : config.webgl.unmaskedRenderer || config.webgl.renderer;
        }
        return originalFn.call(this, param);
      };
    }
    const originalGetParameter = WebGLRenderingContext.prototype.getParameter;
    WebGLRenderingContext.prototype.getParameter = spoofFunction(originalGetParameter, webglHandler(originalGetParameter), 'getParameter');
    if (typeof WebGL2RenderingContext !== 'undefined') {
      const originalGetParameter2 = WebGL2RenderingContext.prototype.getParameter;
      WebGL2RenderingContext.prototype.getParameter = spoofFunction(originalGetParameter2, webglHandler(originalGetParameter2), 'getParameter');
    }
  }

  // Intl API locale override to match navigator.language
  const configuredLanguage = config.navigator?.language || 'en-US';

  // Override Intl.DateTimeFormat
  if (typeof Intl.DateTimeFormat !== 'undefined') {
    const origDTF = Intl.DateTimeFormat;
    const SpoofedDTF = function(locales, options) {
      return new origDTF(locales || configuredLanguage, options);
    };
    Object.setPrototypeOf(SpoofedDTF, origDTF);
    SpoofedDTF.prototype = origDTF.prototype;
    SpoofedDTF.supportedLocalesOf = origDTF.supportedLocalesOf;
    SpoofedDTF.toString = function() { return 'function DateTimeFormat() { [native code] }'; };
    Intl.DateTimeFormat = SpoofedDTF;
  }

  // Override Intl.NumberFormat
  if (typeof Intl.NumberFormat !== 'undefined') {
    const origNF = Intl.NumberFormat;
    const SpoofedNF = function(locales, options) {
      return new origNF(locales || configuredLanguage, options);
    };
    Object.setPrototypeOf(SpoofedNF, origNF);
    SpoofedNF.prototype = origNF.prototype;
    SpoofedNF.supportedLocalesOf = origNF.supportedLocalesOf;
    SpoofedNF.toString = function() { return 'function NumberFormat() { [native code] }'; };
    Intl.NumberFormat = SpoofedNF;
  }

  // Canvas noise injection removed - causes detectable tampering

  // Navigator.connection (NetworkInformation API)
  if (navigator.connection) {
    var connDefaults = { effectiveType: '4g', rtt: 50, downlink: 10, saveData: false };
    for (var _ck of Object.keys(connDefaults)) {
      try {
        Object.defineProperty(navigator.connection, _ck, {
          get: (function(v) { return function() { return v; }; })(connDefaults[_ck]),
          configurable: true, enumerable: true
        });
      } catch(e) {}
    }
  }

  // Cleanup
  try { delete window.__FINGERPRINT_CONFIG__; } catch (e) { window.__FINGERPRINT_CONFIG__ = undefined; }
})();
`
}

/**
 * Update an existing extension with new fingerprint configuration
 */
export async function updateExtensionConfig(
  fingerprintConfig: FingerprintConfig,
  profileDir: string,
): Promise<void> {
  // Simply rebuild the extension
  await buildFingerprintExtension(fingerprintConfig, profileDir)
}

// ============================================================================
// Firefox MV2 Fingerprint Extension (for Zen Browser)
// ============================================================================

function getMV2TemplateDir(): string {
  const defaultDir = join(__dirname, 'fingerprint-extension-mv2')
  const possiblePaths = [
    defaultDir,
    join(
      process.cwd(),
      'packages',
      'shared',
      'src',
      'browser-profiles',
      'fingerprint-extension-mv2',
    ),
  ]

  for (const p of possiblePaths) {
    if (existsSync(p)) {
      return p
    }
  }

  return possiblePaths[0] ?? defaultDir
}

/**
 * Build a Firefox MV2 fingerprint extension for Zen Browser.
 *
 * Firefox MV2 content scripts run in an isolated sandbox, so we inject
 * the fingerprint spoofing code into the MAIN world via a <script> tag.
 * The inject.js from the MV3 template is reused for the actual spoofing logic.
 *
 * @returns Path to the built extension directory
 */
export async function buildFingerprintExtensionMV2(
  fingerprintConfig: FingerprintConfig,
  profileDir: string,
): Promise<string> {
  const extensionDir = join(profileDir, 'fingerprint-extension-mv2')

  if (!existsSync(extensionDir)) {
    mkdirSync(extensionDir, { recursive: true })
  }

  // Copy MV2 manifest.json
  const mv2TemplateDir = getMV2TemplateDir()
  const manifestTemplatePath = join(mv2TemplateDir, 'manifest.json')
  const manifestOutputPath = join(extensionDir, 'manifest.json')

  if (existsSync(manifestTemplatePath)) {
    cpSync(manifestTemplatePath, manifestOutputPath)
  } else {
    const manifest = {
      manifest_version: 2,
      name: 'Fingerprint Guard',
      version: '1.0.0',
      description: 'Browser fingerprint protection for anti-detection',
      browser_specific_settings: {
        gecko: { id: FINGERPRINT_MV2_EXT_ID },
      },
      content_scripts: [
        {
          matches: ['<all_urls>'],
          js: ['content.js'],
          run_at: 'document_start',
          all_frames: true,
        },
      ],
    }
    writeFileSync(manifestOutputPath, JSON.stringify(manifest, null, 2))
  }

  // Firefox MV2 content scripts run in a sandbox but have access to
  // wrappedJSObject (the page's real window) and exportFunction/cloneInto
  // to expose functions to the page. This bypasses CSP restrictions that
  // block <script> tag injection.
  const configJson = JSON.stringify(fingerprintConfig)
  const contentScript = buildMV2ContentScript(configJson, fingerprintConfig)

  writeFileSync(join(extensionDir, 'content.js'), contentScript)

  return extensionDir
}

/**
 * Build content.js for Firefox MV2 using wrappedJSObject.eval().
 *
 * Firefox MV2 content scripts have Xray vision but can call
 * wrappedJSObject.eval() to execute code in the page's JS context.
 * This bypasses CSP (unlike <script> tag injection) because eval()
 * is called from the privileged content script scope.
 *
 * Only font spoofing is implemented — other fingerprint overrides
 * (navigator, screen, WebGL, etc.) are handled by the C++ kernel.
 */
function buildMV2ContentScript(
  _configJson: string,
  fingerprintConfig: FingerprintConfig,
): string {
  const fonts = fingerprintConfig.fonts?.enabledFonts ?? []
  const fontsJson = JSON.stringify(fonts)

  // Build generic font set based on target platform.
  // -apple-system and BlinkMacSystemFont are macOS-only; including them
  // in a Windows profile leaks the real host OS to detection scripts.
  const isWindows = fingerprintConfig.navigator?.platform?.startsWith('Win')
  const genericFonts = [
    'serif',
    'sans-serif',
    'monospace',
    'cursive',
    'fantasy',
    'system-ui',
  ]
  if (!isWindows) {
    genericFonts.push('-apple-system', 'BlinkMacSystemFont')
  }
  const genericJson = JSON.stringify(genericFonts)

  // The code that runs inside wrappedJSObject.eval() — in page context
  const pageCode = `(function() {
  var ALLOWED = new Set(${fontsJson});
  var GENERIC = new Set(${genericJson});
  if (ALLOWED.size === 0) return;

  // --- document.fonts.check() ---
  var origCheck = document.fonts.check.bind(document.fonts);
  document.fonts.check = function(font, text) {
    var family = font.replace(/^[\\\\d.]+(?:px|pt|em|rem|%|vw|vh|vmin|vmax)\\\\s+/, "")
      .replace(/["']/g, "").trim();
    if (!ALLOWED.has(family) && !ALLOWED.has(family.toLowerCase()) &&
        !GENERIC.has(family.toLowerCase())) {
      return false;
    }
    return origCheck(font, text);
  };

  // --- document.fonts.forEach() ---
  var origForEach = document.fonts.forEach.bind(document.fonts);
  document.fonts.forEach = function(callback, thisArg) {
    origForEach(function(fontFace, index, set) {
      var family = fontFace.family.replace(/["']/g, "");
      if (ALLOWED.has(family) || ALLOWED.has(fontFace.family)) {
        callback.call(thisArg, fontFace, index, set);
      }
    }, thisArg);
  };

  // --- document.fonts[Symbol.iterator] ---
  var origIter = document.fonts[Symbol.iterator].bind(document.fonts);
  document.fonts[Symbol.iterator] = function*() {
    for (var ff of origIter()) {
      var family = ff.family.replace(/["']/g, "");
      if (ALLOWED.has(family) || ALLOWED.has(ff.family)) yield ff;
    }
  };

  // --- document.fonts.size ---
  try {
    Object.defineProperty(document.fonts, "size", {
      get: function() {
        var c = 0;
        origForEach(function(ff) {
          var family = ff.family.replace(/["']/g, "");
          if (ALLOWED.has(family) || ALLOWED.has(ff.family)) c++;
        });
        return c;
      },
      configurable: true
    });
  } catch(e) {}
})();`

  // Escape for embedding in a JS string literal
  const escaped = pageCode
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$/g, '\\$')

  return `// Firefox MV2 Fingerprint Guard — Font Spoofing
// Uses wrappedJSObject.eval() to run in page context (bypasses CSP)
(function() {
  try {
    window.wrappedJSObject.eval(\`${escaped}\`);
  } catch(e) {
    // Fallback: try <script> injection for pages without CSP
    try {
      var s = document.createElement("script");
      s.textContent = ${JSON.stringify(pageCode)};
      document.documentElement.appendChild(s);
      s.remove();
    } catch(e2) {}
  }
})();
`
}

/**
 * Package an extension directory as an .xpi file (zip with .xpi extension).
 * Firefox loads .xpi files from profile/extensions/{extension-id}.xpi
 *
 * @returns Path to the .xpi file
 */
export function packageAsXpi(extensionDir: string, outputPath: string): string {
  if (existsSync(outputPath)) {
    unlinkSync(outputPath)
  }

  execSync(`cd "${extensionDir}" && zip -r -FS "${outputPath}" .`, {
    stdio: 'pipe',
  })

  return outputPath
}

/**
 * Build the MV2 fingerprint extension and package it as .xpi for Zen Browser.
 *
 * @returns Path to the .xpi file
 */
export async function buildAndPackageFingerprintExtensionMV2(
  fingerprintConfig: FingerprintConfig,
  profileDir: string,
): Promise<string> {
  const extensionDir = await buildFingerprintExtensionMV2(
    fingerprintConfig,
    profileDir,
  )
  const xpiPath = join(profileDir, 'fingerprint-guard.xpi')
  return packageAsXpi(extensionDir, xpiPath)
}

export { FINGERPRINT_MV2_EXT_ID }
