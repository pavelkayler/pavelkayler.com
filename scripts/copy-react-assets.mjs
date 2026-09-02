#!/usr/bin/env node
import { copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIST = path.join(ROOT, 'dist')
const manifest = JSON.parse(await readFile(path.join(ROOT, 'src/generated/asset-manifest.json'), 'utf8'))

async function copyAsset(relativePath) {
  const source = path.join(ROOT, relativePath)
  const target = path.join(DIST, relativePath)
  try {
    const info = await stat(source)
    if (!info.isFile()) return
    await mkdir(path.dirname(target), { recursive: true })
    await copyFile(source, target)
  } catch {
    throw new Error(`Missing generated asset: ${relativePath}`)
  }
}

// Wfolio's core Polina layout/theme rules were emitted as inline <style> blocks,
// while the linked vendor stylesheet mostly contains shared/vendor assets such as icons.
// Preserve the inline rules verbatim in a root-level CSS file. Keeping the CSS at the
// publish root also preserves its original relative url(assets/...) semantics.
const legacyHome = await readFile(path.join(ROOT, 'legacy-source', 'index.html'), 'utf8')
const inlineStyles = [...legacyHome.matchAll(/<style(?:\s[^>]*)?>([\s\S]*?)<\/style>/gi)]
  .map((match) => match[1])
  .join('\n\n')

if (!inlineStyles.trim()) {
  throw new Error('Could not extract legacy Wfolio inline theme CSS')
}

await writeFile(
  path.join(DIST, 'legacy-theme.css'),
  `/* Extracted from the archived Wfolio page for React fidelity. */\n${inlineStyles}\n`,
)

// Ship only the legacy assets that the React shell and retained CSS can still use.
// The archived Wfolio runtime JS, builder resources, locale flags, and unrelated assets
// deliberately stay out of dist. Modern browsers use the WOFF2 Font Awesome sources,
// so the legacy TTF fallbacks are intentionally not published.
const runtimeAssets = [
  'assets/mobile-overrides.css',
  'assets/folio/desktop/vendor/polina-3994a6f8acd9e18fe38b14dbbad877484965df0633ca7776ab996d2430e39a9f.css',
  'assets/custom-icons-cb5906d824b59115b50c97eba5c0ee88aa5a4acb1a3af5a672f988e36a617629.woff2',
  'assets/font-awesome/fa-brands-400-42c6ccd2717a8509dd84c26181c64985ac29600b9d04d9b5a34b488fbf3075e1.woff2',
  'assets/font-awesome/fa-light-300-e773295f27b81341e6948427170f7e29e2efac0aa00f9288185dc22da580ee56.woff2',
  'assets/font-awesome/fa-solid-900-9980baf58c671d191663b98fd1f8b3558c021fd3ca8bc831cee1b1b132b39d8d.woff2',
  'assets/icons/play-5a2cfa658b34b5b1463187d6bad7d18ce0e472d3a5ed1c6910b08c8d76263cf1.png',
  'assets/icons/arrow_left_white-cf28a26311868dd4643253ea36f74a09da8a70eaaff77d7d1257fe4e58ac0d7b.png',
  'assets/icons/arrow_right_white-b0b396c47eac4496b0ff49a7fe411ccab238e03d7db9c3555226e269f67b80c7.png',
]

for (const asset of runtimeAssets) await copyAsset(asset)
await copyFile(path.join(ROOT, 'favicon.ico'), path.join(DIST, 'favicon.ico'))

for (const asset of manifest) await copyAsset(asset)

// BrowserRouter on GitHub Pages: create actual index files for every public route so
// direct navigation and refresh return HTTP 200 instead of relying on the 404 shell.
for (const route of ['works', 'portraits', 'projects', 'brands', 'contacts']) {
  const routeDir = path.join(DIST, route)
  await mkdir(routeDir, { recursive: true })
  await copyFile(path.join(DIST, 'index.html'), path.join(routeDir, 'index.html'))
}

// Keep a generic fallback as a safety net for unknown/deep links.
await copyFile(path.join(DIST, 'index.html'), path.join(DIST, '404.html'))

let total = 0
async function walk(directory) {
  const { readdir } = await import('node:fs/promises')
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name)
    if (entry.isDirectory()) await walk(full)
    else total += (await stat(full)).size
  }
}
await walk(DIST)
console.log(
  `React dist size: ${(total / 1024 / 1024).toFixed(1)} MiB; copied ${manifest.length} selected media assets and ${runtimeAssets.length} runtime assets.`,
)
