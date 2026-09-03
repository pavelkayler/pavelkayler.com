#!/usr/bin/env node
import { copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { load } from 'cheerio'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIST = path.join(ROOT, 'dist')
const manifest = JSON.parse(await readFile(path.join(ROOT, 'src/generated/asset-manifest.json'), 'utf8'))
const pages = JSON.parse(await readFile(path.join(ROOT, 'src/generated/pages.json'), 'utf8'))
const socialImages = JSON.parse(await readFile(path.join(ROOT, 'src/generated/social-images.json'), 'utf8'))
const SITE_ORIGIN = 'https://pavelkayler.com'
const SITE_NAME = 'Pavel Kayler | Photographer'
const ROBOTS = 'follow, index, max-snippet:-1, max-video-preview:-1, max-image-preview:large'

async function copyAssetTo(sourceRelativePath, targetRelativePath) {
  const source = path.join(ROOT, sourceRelativePath)
  const target = path.join(DIST, targetRelativePath)
  try {
    const info = await stat(source)
    if (!info.isFile()) return
    await mkdir(path.dirname(target), { recursive: true })
    await copyFile(source, target)
  } catch {
    throw new Error(`Missing generated asset: ${sourceRelativePath}`)
  }
}

async function copyAsset(relativePath) {
  await copyAssetTo(relativePath, relativePath)
}

const oswaldV49Files = [
  'TK3_WkUHHAIjg75cFRf3bXL8LICs1_FvsUtiZTaR.woff2',
  'TK3_WkUHHAIjg75cFRf3bXL8LICs1_FvsUJiZTaR.woff2',
  'TK3_WkUHHAIjg75cFRf3bXL8LICs1_FvsUliZTaR.woff2',
  'TK3_WkUHHAIjg75cFRf3bXL8LICs1_FvsUhiZTaR.woff2',
  'TK3_WkUHHAIjg75cFRf3bXL8LICs1_FvsUZiZQ.woff2',
  'TK3_WkUHHAIjg75cFRf3bXL8LICs1xZosUtiZTaR.woff2',
  'TK3_WkUHHAIjg75cFRf3bXL8LICs1xZosUJiZTaR.woff2',
  'TK3_WkUHHAIjg75cFRf3bXL8LICs1xZosUliZTaR.woff2',
  'TK3_WkUHHAIjg75cFRf3bXL8LICs1xZosUhiZTaR.woff2',
  'TK3_WkUHHAIjg75cFRf3bXL8LICs1xZosUZiZQ.woff2',
]

const oswaldRemoteBase = 'https://fonts.gstatic.com/s/oswald/v49/'
const oswaldLocalBase = 'assets/fonts/oswald/'

async function copyVendoredOswald() {
  let bytes = 0
  for (const filename of oswaldV49Files) {
    const relativePath = `${oswaldLocalBase}${filename}`
    const buffer = await readFile(path.join(ROOT, relativePath))
    if (buffer.length < 1000 || buffer.subarray(0, 4).toString('ascii') !== 'wOF2') {
      throw new Error(`Invalid vendored WOFF2: ${relativePath} (${buffer.length} bytes)`)
    }
    await copyAsset(relativePath)
    bytes += buffer.length
  }
  await copyAsset(`${oswaldLocalBase}OFL.txt`)
  console.log(`Copied vendored Oswald v49: ${oswaldV49Files.length} WOFF2 files, ${(bytes / 1024).toFixed(1)} KiB.`)
}

// Wfolio's core Polina layout/theme rules were emitted as inline <style> blocks,
// while the linked vendor stylesheet mostly contains shared/vendor assets such as icons.
// Preserve the inline rules in a root-level CSS file, but replace the archived Google
// Fonts URLs with local vendored files from the exact same Oswald v49 release. Keeping
// the CSS at the publish root also preserves its original relative url(assets/...) semantics.
const legacyHome = await readFile(path.join(ROOT, 'legacy-source', 'index.html'), 'utf8')
let inlineStyles = [...legacyHome.matchAll(/<style(?:\s[^>]*)?>([\s\S]*?)<\/style>/gi)]
  .map((match) => match[1])
  .join('\n\n')

if (!inlineStyles.trim()) {
  throw new Error('Could not extract legacy Wfolio inline theme CSS')
}

for (const filename of oswaldV49Files) {
  const remoteUrl = `${oswaldRemoteBase}${filename}`
  if (!inlineStyles.includes(remoteUrl)) {
    throw new Error(`Archived Oswald v49 source is missing from legacy CSS: ${filename}`)
  }
  inlineStyles = inlineStyles.replaceAll(remoteUrl, `${oswaldLocalBase}${filename}`)
}

if (/fonts\.(?:gstatic|googleapis)\.com/i.test(inlineStyles)) {
  throw new Error('External Google Fonts reference remains in generated legacy CSS')
}

await writeFile(
  path.join(DIST, 'legacy-theme.css'),
  `/* Extracted from the archived Wfolio page for React fidelity; Oswald v49 is self-hosted. */\n${inlineStyles}\n`,
)
await copyVendoredOswald()

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
for (const image of socialImages) await copyAssetTo(image.source, image.target)

await copyFile(path.join(ROOT, 'robots.txt'), path.join(DIST, 'robots.txt'))
await copyFile(path.join(ROOT, 'sitemap.xml'), path.join(DIST, 'sitemap.xml'))

function canonicalUrl(page) {
  if (page.path === '/') return `${SITE_ORIGIN}/`
  return `${SITE_ORIGIN}${page.path.replace(/\/+$/, '')}/`
}

function socialImageUrl(page) {
  if (!page.socialImage) return ''
  return `${SITE_ORIGIN}${page.socialImage.startsWith('/') ? page.socialImage : `/${page.socialImage}`}`
}

function setMeta($, attribute, key, content) {
  let element = $(`meta[${attribute}="${key}"]`).first()
  if (!element.length) {
    $('head').append(`<meta ${attribute}="${key}">`)
    element = $(`meta[${attribute}="${key}"]`).first()
  }
  element.attr('content', content)
}

function removeMeta($, attribute, key) {
  $(`meta[${attribute}="${key}"]`).remove()
}

function setCanonical($, href) {
  let element = $('link[rel="canonical"]').first()
  if (!element.length) {
    $('head').append('<link rel="canonical">')
    element = $('link[rel="canonical"]').first()
  }
  element.attr('href', href)
}

function setStructuredData($, page, canonical) {
  let element = $('script[type="application/ld+json"][data-seo-schema]').first()
  if (!element.length) {
    $('head').append('<script type="application/ld+json" data-seo-schema></script>')
    element = $('script[type="application/ld+json"][data-seo-schema]').first()
  }

  const schema = page.path === '/'
    ? {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: SITE_NAME,
        url: canonical,
      }
    : {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: page.title,
        description: page.description,
        url: canonical,
        isPartOf: {
          '@type': 'WebSite',
          name: SITE_NAME,
          url: `${SITE_ORIGIN}/`,
        },
      }

  element.text(JSON.stringify(schema))
}

function renderSeoShell(shell, page) {
  const $ = load(shell, { decodeEntities: false })
  const canonical = canonicalUrl(page)
  const socialImage = socialImageUrl(page)

  $('html').attr('lang', 'ru')
  $('title').text(page.title)
  setCanonical($, canonical)

  setMeta($, 'name', 'description', page.description)
  setMeta($, 'name', 'robots', ROBOTS)
  setMeta($, 'name', 'yandex-verification', '1c1709d7e995c421')
  setMeta($, 'name', 'google-site-verification', 'DBpBXjMNQuj0EGQLO3MwtrO-rJ8OmpT6NQ0HmomTFbY')

  setMeta($, 'property', 'og:title', page.title)
  setMeta($, 'property', 'og:description', page.description)
  setMeta($, 'property', 'og:type', 'website')
  setMeta($, 'property', 'og:locale', 'ru_RU')
  setMeta($, 'property', 'og:site_name', SITE_NAME)
  setMeta($, 'property', 'og:url', canonical)

  setMeta($, 'name', 'twitter:card', 'summary_large_image')
  setMeta($, 'name', 'twitter:domain', 'pavelkayler.com')
  setMeta($, 'name', 'twitter:url', canonical)
  setMeta($, 'name', 'twitter:title', page.title)
  setMeta($, 'name', 'twitter:description', page.description)

  if (socialImage) {
    setMeta($, 'property', 'og:image', socialImage)
    setMeta($, 'property', 'vk:image', socialImage)
    setMeta($, 'name', 'twitter:image', socialImage)
  } else {
    removeMeta($, 'property', 'og:image')
    removeMeta($, 'property', 'vk:image')
    removeMeta($, 'name', 'twitter:image')
  }

  setStructuredData($, page, canonical)
  return $.html()
}

const shell = await readFile(path.join(DIST, 'index.html'), 'utf8')

// BrowserRouter on GitHub Pages: create actual index files for every public route so
// direct navigation and refresh return HTTP 200. Each shell receives route-specific SEO
// before it is written, rather than publishing six identical copies of the home head.
for (const page of Object.values(pages)) {
  if (page.path === '/') {
    await writeFile(path.join(DIST, 'index.html'), renderSeoShell(shell, page))
    continue
  }

  const routeName = page.path.replace(/^\/+|\/+$/g, '')
  const routeDir = path.join(DIST, routeName)
  await mkdir(routeDir, { recursive: true })
  await writeFile(path.join(routeDir, 'index.html'), renderSeoShell(shell, page))
}

// Keep a generic fallback as a safety net for unknown/deep links. It should never be
// indexed as a page of its own; React will redirect an unknown route to the home page.
const $404 = load(shell, { decodeEntities: false })
$404('title').text('Страница не найдена | PAVEL KAYLER')
setMeta($404, 'name', 'robots', 'noindex, nofollow')
$404('link[rel="canonical"]').remove()
$404('meta[property="og:url"]').remove()
$404('meta[name="twitter:url"]').remove()
await writeFile(path.join(DIST, '404.html'), $404.html())

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
  `React dist size: ${(total / 1024 / 1024).toFixed(1)} MiB; copied ${manifest.length} selected media assets, ${runtimeAssets.length} runtime assets, ${socialImages.length} social images, and ${oswaldV49Files.length} vendored Oswald files.`,
)
