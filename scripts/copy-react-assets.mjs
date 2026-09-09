#!/usr/bin/env node
import { copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { load } from 'cheerio'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIST = path.join(ROOT, 'dist')
const manifest = JSON.parse(await readFile(path.join(ROOT, 'src/content/media-manifest.json'), 'utf8'))
const pages = JSON.parse(await readFile(path.join(ROOT, 'src/content/page-metadata.json'), 'utf8'))
const socialImages = JSON.parse(await readFile(path.join(ROOT, 'src/content/social-images.json'), 'utf8'))
const SITE_ORIGIN = 'https://pavelkayler.com'
const SITE_NAME = 'Pavel Kayler | Photographer'
const ROBOTS = 'follow, index, max-snippet:-1, max-video-preview:-1, max-image-preview:large'
const NOT_FOUND_TITLE = 'Страница не найдена | PAVEL KAYLER'
const NOT_FOUND_DESCRIPTION = 'Запрошенная страница не найдена.'

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
  'oswald-400-cyrillic-ext.woff2',
  'oswald-400-cyrillic.woff2',
  'oswald-400-vietnamese.woff2',
  'oswald-400-latin-ext.woff2',
  'oswald-400-latin.woff2',
  'oswald-700-cyrillic-ext.woff2',
  'oswald-700-cyrillic.woff2',
  'oswald-700-vietnamese.woff2',
  'oswald-700-latin-ext.woff2',
  'oswald-700-latin.woff2',
]

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

await copyAssetTo('assets/styles/site-theme.css', 'site-theme.css')
await copyVendoredOswald()

// Ship only runtime assets used by the React shell and retained theme CSS.
// Builder resources and unrelated fallbacks stay out of dist.
const runtimeAssets = [
  'assets/fonts/font-awesome/fontawesome-brands-400.ttf',
  'assets/fonts/font-awesome/fontawesome-light-300.ttf',
  'assets/fonts/font-awesome/fontawesome-solid-900.ttf',
  'assets/styles/responsive.css',
  'assets/styles/portfolio-layout.css',
  'assets/fonts/site-icons.woff2',
  'assets/fonts/font-awesome/fontawesome-brands-400.woff2',
  'assets/fonts/font-awesome/fontawesome-light-300.woff2',
  'assets/fonts/font-awesome/fontawesome-solid-900.woff2',
  'assets/icons/play.png',
  'assets/icons/arrow-left-white.png',
  'assets/icons/arrow-right-white.png',
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
  $('body').attr('class', page.bodyClass)
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
// and the matching body class before it is written, avoiding a home-theme flash before React boots.
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

// Keep a generic fallback for unknown/deep links. It deliberately carries no canonical,
// social preview image or structured data, and React renders a real 404 instead of redirecting.
const $404 = load(shell, { decodeEntities: false })
$404('html').attr('lang', 'ru')
if (pages.works?.bodyClass) $404('body').attr('class', pages.works.bodyClass)
$404('title').text(NOT_FOUND_TITLE)
setMeta($404, 'name', 'description', NOT_FOUND_DESCRIPTION)
setMeta($404, 'name', 'robots', 'noindex, nofollow')
setMeta($404, 'property', 'og:title', NOT_FOUND_TITLE)
setMeta($404, 'property', 'og:description', NOT_FOUND_DESCRIPTION)
setMeta($404, 'property', 'og:type', 'website')
setMeta($404, 'property', 'og:locale', 'ru_RU')
setMeta($404, 'property', 'og:site_name', SITE_NAME)
setMeta($404, 'name', 'twitter:card', 'summary')
setMeta($404, 'name', 'twitter:domain', 'pavelkayler.com')
setMeta($404, 'name', 'twitter:title', NOT_FOUND_TITLE)
setMeta($404, 'name', 'twitter:description', NOT_FOUND_DESCRIPTION)
$404('link[rel="canonical"]').remove()
removeMeta($404, 'property', 'og:url')
removeMeta($404, 'property', 'og:image')
removeMeta($404, 'property', 'vk:image')
removeMeta($404, 'name', 'twitter:url')
removeMeta($404, 'name', 'twitter:image')
$404('script[type="application/ld+json"][data-seo-schema]').remove()
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
