#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { load } from 'cheerio'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE = path.join(ROOT, 'legacy-source')
const OUT = path.join(ROOT, 'src', 'generated', 'structured.ts')

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

function cleanText(value = '') {
  return value.replace(/\s+/g, ' ').trim()
}

function localize(value = '') {
  value = value.trim().replace(/^\//, '')
  return /^(?:i\.wfolio\.ru|static\.wfolio\.ru|vp\.wfolio\.ru|assets)\//.test(value)
    ? `__BASE__${value}`
    : value
}

function selectSrcset(raw = '') {
  const candidates = raw.split(',').map((candidate) => {
    const match = candidate.trim().match(/^(\S+)\s+(\d+)w$/)
    return match ? { src: match[1], width: Number(match[2]) } : null
  }).filter(Boolean)
  if (!candidates.length) return ''

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

function imageData($, lazy) {
  const image = lazy.find('img').first()
  const placeholder = lazy.find('canvas.placeholder').first()
  const style = placeholder.attr('style') || ''
  const color = style.match(/background-color:\s*([^;]+)/i)?.[1]?.trim() || '#222'

  return {
    src: localize(image.attr('data-src') || image.attr('src') || ''),
    srcSet: selectSrcset(image.attr('data-srcset') || image.attr('srcset') || ''),
    alt: image.attr('alt') || '',
    width: Number(lazy.attr('data-width') || image.attr('width') || 1),
    height: Number(lazy.attr('data-height') || image.attr('height') || 1),
    aspect: Number(lazy.attr('data-aspect') || 1),
    placeholderWidth: Number(placeholder.attr('width') || lazy.attr('data-width') || 1),
    placeholderHeight: Number(placeholder.attr('height') || lazy.attr('data-height') || 1),
    placeholderColor: color,
  }
}

function listingCards($, root) {
  return root.find('.listing-item').map((_, element) => {
    const item = $(element)
    const link = item.find('a.listing-link').first()
    const href = link.attr('href') || '/'
    return {
      to: routeMap.get(href) || href,
      title: cleanText(item.find('.listing-title').text()),
      image: imageData($, item.find('.lazy-image').first()),
    }
  }).get()
}

function galleryPhoto($, element) {
  const piece = $(element)
  const link = piece.find('a.js-gallery-link').first()
  const rawVersions = link.attr('data-gallery-versions') || '[]'
  let versions = []
  try {
    versions = JSON.parse(rawVersions)
  } catch (error) {
    console.warn(`Could not parse gallery versions for ${piece.attr('id')}:`, error)
  }

  const best = versions
    .filter((item) => item?.src && item?.w && item?.h)
    .sort((a, b) => (b.w * b.h) - (a.w * a.h))[0]

  const preview = imageData($, piece.find('.lazy-image').first())
  return {
    id: piece.attr('id') || `piece-${Math.random().toString(36).slice(2)}`,
    aspect: Number(piece.attr('data-aspect') || preview.aspect || 1),
    image: preview,
    fullscreenSrc: localize(best?.src || preview.src.replace('__BASE__', '')),
    fullscreenWidth: Number(best?.w || preview.width),
    fullscreenHeight: Number(best?.h || preview.height),
  }
}

async function parseAlbum(file, key) {
  const html = await readFile(path.join(SOURCE, file), 'utf8')
  const $ = load(html, { decodeEntities: false })
  const cover = $('.cover').first()
  const video = cover.find('video').first()
  const source = video.find('source[src]').first()
  const gallery = $('.album-masonry.js-gallery').first()
  const postfix = $('.-album-postfix').first()
  const relatedContainer = $('.listing.js-listing').last()

  return {
    key,
    hasCover: cover.length > 0,
    cover: cover.length > 0 ? {
      title: cleanText(cover.find('.cover-content h1').first().text()),
      poster: localize(video.attr('poster') || ''),
      videoSrc: localize(source.attr('src') || ''),
    } : null,
    photos: gallery.find('.piece.-photo').map((_, element) => galleryPhoto($, element)).get(),
    quote: postfix.find('blockquote p').map((_, element) => cleanText($(element).text())).get(),
    related: listingCards($, relatedContainer),
  }
}

const worksHtml = await readFile(path.join(SOURCE, 'works.html'), 'utf8')
const $works = load(worksHtml, { decodeEntities: false })
const logoImage = $works('.logo .logo-image').first()

const siteLogo = {
  src: localize(logoImage.attr('data-src') || logoImage.attr('src') || ''),
  alt: logoImage.attr('alt') || 'pavelkayler.com',
  maxWidth: 209,
  maxHeight: 35,
}

const worksCards = listingCards($works, $works('.listing.js-listing').first())
const worksQuote = $works('.-listing-postfix blockquote p').map((_, element) =>
  cleanText($works(element).text()),
).get()

const contactsHtml = await readFile(path.join(SOURCE, 'contacts.html'), 'utf8')
const $contacts = load(contactsHtml, { decodeEntities: false })
const contactImageNode = $contacts('.picture-section .lazy-image').first()
const contactText = $contacts('.text-section').filter((_, element) => $contacts(element).find('h1').length > 0).first()
const contactAction = $contacts('.action-section a.button').first()

const contacts = {
  image: imageData($contacts, contactImageNode),
  heading: cleanText(contactText.find('h1').text()),
  text: cleanText(contactText.find('p').first().text()),
  actionHref: contactAction.attr('href') || 'https://t.me/pavelkayler',
  actionLabel: cleanText(contactAction.text()),
}

const albums = {
  portraits: await parseAlbum('portraits.html', 'portraits'),
  projects: await parseAlbum('projects.html', 'projects'),
  brands: await parseAlbum('brands.html', 'brands'),
}

const output = `// AUTO-GENERATED from legacy-source. Do not edit directly.\n\nexport interface StructuredImage {\n  src: string\n  srcSet: string\n  alt: string\n  width: number\n  height: number\n  aspect: number\n  placeholderWidth: number\n  placeholderHeight: number\n  placeholderColor: string\n}\n\nexport interface WorksCard {\n  to: string\n  title: string\n  image: StructuredImage\n}\n\nexport interface GalleryPhoto {\n  id: string\n  aspect: number\n  image: StructuredImage\n  fullscreenSrc: string\n  fullscreenWidth: number\n  fullscreenHeight: number\n}\n\nexport interface AlbumCover {\n  title: string\n  poster: string\n  videoSrc: string\n}\n\nexport interface AlbumContent {\n  key: 'portraits' | 'projects' | 'brands'\n  hasCover: boolean\n  cover: AlbumCover | null\n  photos: GalleryPhoto[]\n  quote: string[]\n  related: WorksCard[]\n}\n\nexport const siteLogo = ${JSON.stringify(siteLogo, null, 2)} as const\n\nexport const worksContent = ${JSON.stringify({ cards: worksCards, quote: worksQuote }, null, 2)} as const\n\nexport const contactsContent = ${JSON.stringify(contacts, null, 2)} as const\n\nexport const albums: Record<'portraits' | 'projects' | 'brands', AlbumContent> = ${JSON.stringify(albums, null, 2)}\n`

await writeFile(OUT, output)
console.log(`Generated native React data: ${worksCards.length} works cards, contacts, albums portraits=${albums.portraits.photos.length}, projects=${albums.projects.photos.length}, brands=${albums.brands.photos.length}.`)
