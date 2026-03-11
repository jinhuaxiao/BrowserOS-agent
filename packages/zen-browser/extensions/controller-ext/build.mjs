import { execSync } from 'node:child_process'
import { cpSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as esbuild from 'esbuild'

const __dirname = dirname(fileURLToPath(import.meta.url))
const isDev = process.argv.includes('--dev')
const outdir = join(__dirname, 'dist')

// Ensure output directory exists
mkdirSync(outdir, { recursive: true })

// Shared esbuild options
const sharedOptions = {
  bundle: true,
  platform: 'browser',
  target: 'firefox115',
  format: 'iife',
  minify: !isDev,
  sourcemap: isDev ? 'inline' : false,
  logLevel: 'info',
}

// Build background script
await esbuild.build({
  ...sharedOptions,
  entryPoints: [join(__dirname, 'src/background/index.ts')],
  outfile: join(outdir, 'background.js'),
  alias: {
    '@/*': './src/*',
  },
})

// Build content script
await esbuild.build({
  ...sharedOptions,
  entryPoints: [join(__dirname, 'src/content/index.ts')],
  outfile: join(outdir, 'content.js'),
  alias: {
    '@/*': './src/*',
  },
})

// Copy manifest.json
cpSync(join(__dirname, 'manifest.json'), join(outdir, 'manifest.json'))

console.log(`Build complete (${isDev ? 'development' : 'production'})`)

// Create .xpi (zip file)
if (!isDev) {
  try {
    const xpiPath = join(__dirname, 'controller.xpi')
    execSync(`cd "${outdir}" && zip -r "${xpiPath}" .`, { stdio: 'inherit' })
    console.log(`Created XPI: ${xpiPath}`)
  } catch (e) {
    console.warn('Failed to create XPI (zip may not be available):', e.message)
  }
}
