/**
 * Fingerprint Extension Builder
 *
 * Dynamically builds a Chrome extension that injects fingerprint overrides
 * into web pages. The extension is built per-profile with embedded configuration.
 */

import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'
import type { FingerprintConfig } from './types.ts'

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
