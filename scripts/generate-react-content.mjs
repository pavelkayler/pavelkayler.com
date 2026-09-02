#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { load } from 'cheerio'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE = path.join(ROOT, 'legacy-source')
const OUT = path.join(ROOT, 'src', 'generated')

const pageDefs = [
  ['home', 'index.html', '/'],
  ['works', 'works.html', '/works'],
  ['portraits', 'portraits.html', '/portraits'],
  ['projects', 'projects.html', '/projects'],
  ['brands', 'brands.html', '/brands'],
  ['contacts', 'contacts.html', '/contacts'],
]

const assets = new Set([
  'i.wfolio.ru/x/24-OcBl4_jLHPgDwqv0G81XC6E-X62eX/mEXzmGl_g4elKlZ5M50eLzysBe3_E8_3/4aRhqmvHzpnrERHNxOKUSDiEpB5ZXNHI/TrHg6dWwkLRTN2uwxrzXa4bcQyviyd-3/2gfFMzYKUVhcD8UvQPYKSg.png',
])

function isLocalAsset(value) {
  return typeof value === 'string' && /^(?:i\.wfolio\.ru|static\.wfolio\.ru|vp\.wfolio\.ru|assets)\//.test(value)
}

function localize(value) {
  if (!value) return value
  if (value.startsWith('__BASE__')) return value
  if (value.startsWith('/')) value = value.slice(1)
  if (isLocalAsset(value)) {
    assets.add(value)
    return `__BASE__${value}`
  }
  return value
}

function selectSrcset(raw) {
  if (!raw) return ''
  const candidates = raw.split(',').map((candidate) => {
    const match = candidate.trim().match(/^(\S+)\s+(\d+)w$/)
    return match ? { src: match[1], width: Number(match[2]) } : null
  }).filter(Boolean)
  if (!candidates.length) return ''

  // Keep this list in sync with generate-structured-content.mjs. The first target
  // resolves to Wfolio's 440/480px candidate and avoids serving a 600/640px image
  // unnecessarily on narrow mobile viewports.
  const wanted = [440, 600, 1240, 1880, 2520]
  const selected = []
  for (const target of wanted) {
    const candidate = candidates.reduce((best, current) =>
      Math.abs(current.width - target) < Math.abs(best.width - target) ? current : best
    )
    if (!selected.some((item) => item.src === candidate.src)) selected.push(candidate)
  }
  return selected.sort((a, b) => a.width - b.width)
    .map(({ src, width }) => `${localize(src)} ${width}w`).join(', ')
}

function scanPageAssets($, root) {
  root.find('img').each((_, element) => {
    const node = $(element)
    const source = node.attr('data-src') || node.attr('src')
    if (source && isLocalAsset(source)) node.attr('src', localize(source))

    const srcset = selectSrcset(node.attr('data-srcset') || node.attr('srcset'))
    if (srcset) node.attr('srcset', srcset)
  })

  root.find('a.js-gallery-link').each((_, element) => {
    const node = $(element)
    const raw = node.attr('data-gallery-versions')
    if (!raw) return
    try {
      const versions = JSON.parse(raw)
      const best = versions.filter((item) => item?.src && item?.w && item?.h)
        .sort((a, b) => (b.w * b.h) - (a.w * a.h))[0]
      if (best) node.attr('href', localize(best.src))
    } catch (error) {
      console.warn('Could not parse gallery versions:', error)
    }
  })

  root.find('video').each((_, element) => {
    const node = $(element)
    const poster = node.attr('poster')
    if (poster && isLocalAsset(poster)) node.attr('poster', localize(poster))
  })

  root.find('source[src]').each((_, element) => {
    const node = $(element)
    const src = node.attr('src')
    if (src && isLocalAsset(src)) node.attr('src', localize(src))
  })

  root.find('[style]').each((_, element) => {
    const node = $(element)
    const style = node.attr('style') || ''
    node.attr('style', style.replace(/url\(["']?([^"')]+)["']?\)/g, (full, url) => {
      return isLocalAsset(url) ? `url(${localize(url)})` : full
    }))
  })
}

await mkdir(OUT, { recursive: true })
const pages = {}

for (const [key, file, routePath] of pageDefs) {
  const html = await readFile(path.join(SOURCE, file), 'utf8')
  const $ = load(html, { decodeEntities: false })
  const wrapper = $('<div></div>')
  const cover = $('.cover').first()
  const main = $('main.page-main').first()
  if (cover.length) wrapper.append(cover.clone())
  if (main.length) wrapper.append(main.clone())

  scanPageAssets($, wrapper)

  const scannedHtml = wrapper.html() || ''
  const localMatches = scannedHtml.match(/__BASE__((?:i\.wfolio\.ru|static\.wfolio\.ru|vp\.wfolio\.ru|assets)\/[^\s"'<>)]+)/g) || []
  const prefetchAssets = [...new Set(localMatches.map((value) => value.replace('__BASE__', '')))].slice(0, 6)

  pages[key] = {
    key,
    path: routePath,
    title: $('title').text().trim() || 'Pavel Kayler | Photographer',
    description: $('meta[name="description"]').attr('content') || '',
    bodyClass: $('body').attr('class') || 'theme-polina',
    hasCover: cover.length > 0,
    prefetchAssets,
  }
}

const ts = `// AUTO-GENERATED. Do not edit directly.\nexport type PageKey = 'home' | 'works' | 'portraits' | 'projects' | 'brands' | 'contacts'\nexport interface GeneratedPage {\n  key: PageKey\n  path: string\n  title: string\n  description: string\n  bodyClass: string\n  hasCover: boolean\n  prefetchAssets: string[]\n}\nexport const pages: Record<PageKey, GeneratedPage> = ${JSON.stringify(pages, null, 2)}\n`
await writeFile(path.join(OUT, 'pages.ts'), ts)
await writeFile(path.join(OUT, 'asset-manifest.json'), JSON.stringify([...assets].sort(), null, 2) + '\n')
console.log(`Generated ${Object.keys(pages).length} React route metadata entries; ${assets.size} localized assets selected.`)
