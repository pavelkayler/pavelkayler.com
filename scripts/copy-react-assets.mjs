#!/usr/bin/env node
import { copyFile, cp, mkdir, readFile, stat, writeFile } from 'node:fs/promises'
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

// Theme CSS/fonts/icons are still reused during the fidelity-first React migration.
await cp(path.join(ROOT, 'assets'), path.join(DIST, 'assets'), { recursive: true, force: true })
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
console.log(`React dist size: ${(total / 1024 / 1024).toFixed(1)} MiB; copied ${manifest.length} selected media assets.`)
