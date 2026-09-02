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

const routeMap = new Map([
  ['index.html', '/'],
  ['./index.html', '/'],
  ['works.html', '/works'],
  ['./works.html', '/works'],
  ['portraits.html', '/portraits'],
  ['./portraits.html', '/portraits'],
  ['projects.html', '/projects'],
  ['./projects.html', '/projects'],
  ['brands.html', '/brands'],
  ['./brands.html', '/brands'],
  ['contacts.html', '/contacts'],
  ['./contacts.html', '/contacts'],
])

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

  const wanted = [600, 1240, 1880, 2520]
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

function rewritePage($, root) {
  root.find('script, noscript').remove()

  root.find('a[href]').each((_, element) => {
    const node = $(element)
    const href = node.attr('href')
    if (routeMap.has(href)) node.attr('href', routeMap.get(href))
  })

  root.find('img').each((_, element) => {
    const node = $(element)
    const dataSrc = node.attr('data-src')
    const currentSrc = node.attr('src')
    if (dataSrc && isLocalAsset(dataSrc)) node.attr('src', localize(dataSrc))
    else if (currentSrc && isLocalAsset(currentSrc)) node.attr('src', localize(currentSrc))

    const srcset = selectSrcset(node.attr('data-srcset') || node.attr('srcset'))
    if (srcset) {
      node.attr('srcset', srcset)
      node.attr('sizes', '(max-width: 768px) 50vw, 33vw')
    }

    const inCover = node.closest('.cover').length > 0
    node.attr('loading', inCover ? 'eager' : 'lazy')
    node.attr('decoding', 'async')
    if (inCover) node.attr('fetchpriority', 'high')
    node.removeAttr('data-src data-srcset data-sizes')
    node.removeClass('lazyload lazyunload')
  })

  root.find('a.js-gallery-link').each((_, element) => {
    const node = $(element)
    const raw = node.attr('data-gallery-versions')
    if (!raw) return
    try {
      const versions = JSON.parse(raw)
      const best = versions.filter((item) => item?.src && item?.w && item?.h)
        .sort((a, b) => (b.w * b.h) - (a.w * a.h))[0]
      if (!best) return
      node.attr('href', localize(best.src))
      node.attr('data-pswp-width', String(best.w))
      node.attr('data-pswp-height', String(best.h))
      node.removeAttr('data-gallery-versions')
    } catch (error) {
      console.warn('Could not parse gallery versions:', error)
    }
  })

  root.find('video').each((_, element) => {
    const node = $(element)
    const poster = node.attr('poster')
    if (poster && isLocalAsset(poster)) node.attr('poster', localize(poster))
    node.attr('preload', 'metadata')
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

  // These visibility states were previously applied by the Wfolio runtime.
  // React owns initialization now, so render the archived markup in its ready state.
  root.find('.sections-container').addClass('-visible')
  root.find('.logo').addClass('-visible')
  root.find('.comment-list > .comment').addClass('-visible')
  root.find('.slider').each((_, slider) => {
    const slides = $(slider).find('.slide')
    slides.removeClass('-visible')
    slides.first().addClass('-visible')
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
  rewritePage($, wrapper)

  const htmlOut = wrapper.html() || ''
  const localMatches = htmlOut.match(/__BASE__((?:i\.wfolio\.ru|static\.wfolio\.ru|vp\.wfolio\.ru|assets)\/[^\s"'<>)]+)/g) || []
  const prefetchAssets = [...new Set(localMatches.map((value) => value.replace('__BASE__', '')))].slice(0, 6)

  pages[key] = {
    key,
    path: routePath,
    title: $('title').text().trim() || 'Pavel Kayler | Photographer',
    description: $('meta[name="description"]').attr('content') || '',
    bodyClass: $('body').attr('class') || 'theme-polina',
    hasCover: cover.length > 0,
    html: htmlOut,
    prefetchAssets,
  }
}

const ts = `// AUTO-GENERATED. Do not edit directly.\nexport type PageKey = 'home' | 'works' | 'portraits' | 'projects' | 'brands' | 'contacts'\nexport interface GeneratedPage {\n  key: PageKey\n  path: string\n  title: string\n  description: string\n  bodyClass: string\n  hasCover: boolean\n  html: string\n  prefetchAssets: string[]\n}\nexport const pages: Record<PageKey, GeneratedPage> = ${JSON.stringify(pages, null, 2)}\n`
await writeFile(path.join(OUT, 'pages.ts'), ts)
await writeFile(path.join(OUT, 'asset-manifest.json'), JSON.stringify([...assets].sort(), null, 2) + '\n')
console.log(`Generated ${Object.keys(pages).length} React routes; ${assets.size} localized assets selected.`)
