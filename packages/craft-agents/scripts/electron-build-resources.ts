/**
 * Cross-platform resources copy script
 */

import { copyFileSync, cpSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'

const ROOT_DIR = join(import.meta.dir, '..')
const ELECTRON_DIR = join(ROOT_DIR, 'apps/electron')
const DIST_DIR = join(ELECTRON_DIR, 'dist')

const srcDir = join(ELECTRON_DIR, 'resources')
const destDir = join(DIST_DIR, 'resources')

if (existsSync(srcDir)) {
  cpSync(srcDir, destDir, { recursive: true, force: true })
  console.log('📦 Copied resources to dist')
} else {
  console.log('⚠️ No resources directory found')
}

// Copy sql-wasm.wasm for sql.js
// Resolve from @craft-agent/shared which declares sql.js as a dependency
import { dirname } from 'node:path'

const SHARED_DIR = join(ROOT_DIR, 'packages/shared')

const wasmCandidates = [
  join(ROOT_DIR, 'node_modules/sql.js/dist/sql-wasm.wasm'),
  join(SHARED_DIR, 'node_modules/sql.js/dist/sql-wasm.wasm'),
  join(ROOT_DIR, '../node_modules/sql.js/dist/sql-wasm.wasm'),
  join(ROOT_DIR, '../../node_modules/sql.js/dist/sql-wasm.wasm'),
]

// Also try Bun.resolveSync from the shared package dir
try {
  const sqlJsEntry = Bun.resolveSync('sql.js', SHARED_DIR)
  wasmCandidates.unshift(join(dirname(sqlJsEntry), 'sql-wasm.wasm'))
} catch {
  // not resolvable from shared dir
}

const wasmSrc = wasmCandidates.find((p) => existsSync(p))
if (wasmSrc) {
  mkdirSync(DIST_DIR, { recursive: true })
  copyFileSync(wasmSrc, join(DIST_DIR, 'sql-wasm.wasm'))
  console.log('📦 Copied sql-wasm.wasm to dist')
} else {
  console.log('⚠️ sql-wasm.wasm not found in any candidate location')
}
