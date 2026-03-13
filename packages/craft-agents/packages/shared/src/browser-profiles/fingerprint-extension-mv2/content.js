/**
 * MV2 Content Script — injects fingerprint overrides into page MAIN world.
 *
 * Firefox MV2 content scripts run in an isolated sandbox and cannot modify
 * page JS objects directly. We inject a <script> tag to run in MAIN world.
 *
 * The actual inject.js code is embedded at build time by extension-builder.ts.
 */
const script = document.createElement('script')
script.textContent = '/* INJECT_PLACEHOLDER */'
document.documentElement.appendChild(script)
script.remove()
