#!/usr/bin/env node
import { copyFile, cp, mkdir, readFile, stat } from 'node:fs/promises'
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

// Theme CSS/fonts/icons are small compared with the photography payload and are reused 1:1.
await cp(path.join(ROOT, 'assets'), path.join(DIST, 'assets'), { recursive: true, force: true })
await copyFile(path.join(ROOT, 'favicon.ico'), path.join(DIST, 'favicon.ico'))

for (const asset of manifest) await copyAsset(asset)

// GitHub Pages has no rewrite engine. Serving the SPA shell as 404 preserves BrowserRouter
// for direct navigation to /works, /portraits, etc.
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
