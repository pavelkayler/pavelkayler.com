#!/usr/bin/env node
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { load } from 'cheerio'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE = path.join(ROOT, 'legacy-source')
const OUT_DIR = path.join(ROOT, 'src', 'generated', 'content')
const MANIFEST = path.join(ROOT, 'src', 'generated', 'asset-manifest.json')

const routeMap = new Map([
  ['index.html', '/'], ['./index.html', '/'],
  ['works.html', '/works'], ['./works.html', '/works'],
  ['portraits.html', '/portraits'], ['./portraits.html', '/portraits'],
  ['projects.html', '/projects'], ['./projects.html', '/projects'],
  ['brands.html', '/brands'], ['./brands.html', '/brands'],
  ['contacts.html', '/contacts'], ['./contacts.html', '/contacts'],
])

const assets = new Set()
const srcsetTargets = {
  home: [600, 1240, 1880, 2520],
  listing: [600, 1240, 1880],
  gallery: [600, 1240, 2520],
  contact: [600, 1240, 1880],
}

function cleanText(value = '') { return value.replace(/\s+/g, ' ').trim() }
function normalizeLocalPath(value = '') {
  return value
    .trim()
    .replace(/^__BASE__/, '')
    .replace(/^https?:\/\//i, '')
    .replace(/^\/\//, '')
    .replace(/^(?:\.\.\/|\.\/)+/, '')
    .replace(/^\/+/, '')
}
function isLocalAsset(value = '') {
  return /^(?:i\.wfolio\.ru|static\.wfolio\.ru|vp\.wfolio\.ru|assets)\//.test(normalizeLocalPath(value))
}
function localize(value = '') {
  const original = value.trim()
  if (!original) return ''
  const relative = normalizeLocalPath(original)
  if (!isLocalAsset(relative)) return original
  assets.add(relative)
  return `__BASE__${relative}`
}

function selectSrcset(raw = '', wanted = srcsetTargets.home) {
  const candidates = raw.split(',').map((candidate) => {
    const match = candidate.trim().match(/^(\S+)\s+(\d+)w$/)
    return match ? { src: match[1], width: Number(match[2]) } : null
  }).filter(Boolean)
  if (!candidates.length) return []

  const selected = []
  for (const target of wanted) {
    const candidate = candidates.reduce((best, current) => Math.abs(current.width - target) < Math.abs(best.width - target) ? current : best)
    if (!selected.some((item) => item.src === candidate.src)) selected.push(candidate)
  }

  return selected
    .sort((a, b) => a.width - b.width)
    .map(({ src, width }) => ({ src: localize(src), width }))
}

function imageData($, lazy, targets = srcsetTargets.home) {
  const image = lazy.find('img').first()
  const placeholder = lazy.find('canvas.placeholder').first()
  const style = placeholder.attr('style') || ''
  const selected = selectSrcset(image.attr('data-srcset') || image.attr('srcset') || '', targets)
  const fallback = selected.length
    ? selected[Math.min(1, selected.length - 1)].src
    : localize(image.attr('data-src') || image.attr('src') || '')

  return {
    src: fallback,
    srcSet: selected.map(({ src, width }) => `${src} ${width}w`).join(', '),
    alt: image.attr('alt') || '',
    width: Number(lazy.attr('data-width') || image.attr('width') || 1),
    height: Number(lazy.attr('data-height') || image.attr('height') || 1),
    aspect: Number(lazy.attr('data-aspect') || 1),
    placeholderWidth: Number(placeholder.attr('width') || lazy.attr('data-width') || 1),
    placeholderHeight: Number(placeholder.attr('height') || lazy.attr('data-height') || 1),
    placeholderColor: style.match(/background-color:\s*([^;]+)/i)?.[1]?.trim() || '#222',
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
      image: imageData($, item.find('.lazy-image').first(), srcsetTargets.listing),
    }
  }).get()
}

function galleryPhoto($, element) {
  const piece = $(element)
  const link = piece.find('a.js-gallery-link').first()
  let versions = []
  try { versions = JSON.parse(link.attr('data-gallery-versions') || '[]') } catch (error) { console.warn(`Could not parse gallery versions for ${piece.attr('id')}:`, error) }
  const best = versions.filter((item) => item?.src && item?.w && item?.h).sort((a, b) => (b.w * b.h) - (a.w * a.h))[0]
  const preview = imageData($, piece.find('.lazy-image').first(), srcsetTargets.gallery)
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

async function parseHome() {
  const html = await readFile(path.join(SOURCE, 'index.html'), 'utf8')
  const $ = load(html, { decodeEntities: false })
  const cover = $('.cover').first()
  const main = $('main.page-main').first()
  const slides = cover.find('.slider .slide .lazy-image').map((_, element) => imageData($, $(element), srcsetTargets.home)).get()
  const pictureRows = main.find('.sections-container').map((_, element) => {
    const container = $(element)
    const pictureSections = container.find('.picture-section')
    if (!pictureSections.length) return null
    const columns = container.find('.row').first().children().map((_, columnElement) => {
      const column = $(columnElement)
      const section = column.find('.picture-section').first()
      if (!section.length) return null
      return {
        columnClass: column.attr('class') || 'col-sm-12',
        sectionClass: section.attr('class') || 'section-container picture-section -default',
        image: imageData($, section.find('.lazy-image').first(), srcsetTargets.home),
      }
    }).get().filter(Boolean)
    return { containerClass: container.attr('class') || 'sections-container -medium-width', columns }
  }).get().filter(Boolean)
  const actions = main.find('.action-section a.button').map((_, element) => {
    const link = $(element)
    let href = link.attr('href') || '#'
    if (href === 'https://t.me/pavekayler') href = 'https://t.me/pavelkayler'
    return {
      columnClass: link.closest('[class*="col-"]').attr('class') || 'col-sm-12',
      href,
      label: cleanText(link.text()),
      iconClass: link.find('i').attr('class') || '',
    }
  }).get()
  return {
    cover: {
      title: cleanText(cover.find('.cover-content h1').text()),
      subtitle: cleanText(cover.find('.cover-content p').text()),
      delay: Number(cover.find('.slider').attr('data-delay') || 4000),
      slides,
    },
    pictureRows,
    works: listingCards($, main.find('.inline-listing-section .listing').first()),
    actions,
    quote: main.find('.background-accent blockquote p').map((_, element) => cleanText($(element).text())).get(),
  }
}

function prefetchImage(image, sizes) { return { src: image.src, srcSet: image.srcSet, sizes } }
function albumPrefetch(album) {
  const result = []
  if (album.cover?.poster) result.push({ src: album.cover.poster, srcSet: '', sizes: '100vw' })
  result.push(...album.photos.map((photo) => prefetchImage(photo.image, '(max-width: 768px) 50vw, 33vw')))
  return result.slice(0, 6)
}

await mkdir(OUT_DIR, { recursive: true })

const worksHtml = await readFile(path.join(SOURCE, 'works.html'), 'utf8')
const $works = load(worksHtml, { decodeEntities: false })
const logoImage = $works('.logo .logo-image').first()
const siteLogo = {
  src: localize(logoImage.attr('data-src') || logoImage.attr('src') || ''),
  alt: logoImage.attr('alt') || 'pavelkayler.com',
  maxWidth: 209,
  maxHeight: 35,
}
const worksContent = {
  cards: listingCards($works, $works('.listing.js-listing').first()),
  quote: $works('.-listing-postfix blockquote p').map((_, element) => cleanText($works(element).text())).get(),
}

const contactsHtml = await readFile(path.join(SOURCE, 'contacts.html'), 'utf8')
const $contacts = load(contactsHtml, { decodeEntities: false })
const contactText = $contacts('.text-section').filter((_, element) => $contacts(element).find('h1').length > 0).first()
const contactAction = $contacts('.action-section a.button').first()
const contactsContent = {
  image: imageData($contacts, $contacts('.picture-section .lazy-image').first(), srcsetTargets.contact),
  heading: cleanText(contactText.find('h1').text()),
  text: cleanText(contactText.find('p').first().text()),
  actionHref: contactAction.attr('href') || 'https://t.me/pavelkayler',
  actionLabel: cleanText(contactAction.text()),
}

const portraits = await parseAlbum('portraits.html', 'portraits')
const projects = await parseAlbum('projects.html', 'projects')
const brands = await parseAlbum('brands.html', 'brands')
const homeContent = await parseHome()

const routePrefetch = {
  home: [
    ...homeContent.cover.slides.map((image) => prefetchImage(image, '100vw')),
    ...homeContent.pictureRows.flatMap((row) => row.columns.map((column) => prefetchImage(column.image, row.columns.length > 1 ? '(max-width: 768px) 100vw, 50vw' : '100vw'))),
  ].slice(0, 6),
  works: worksContent.cards.map((card) => prefetchImage(card.image, '(max-width: 768px) 100vw, 33vw')).slice(0, 6),
  portraits: albumPrefetch(portraits),
  projects: albumPrefetch(projects),
  brands: albumPrefetch(brands),
  contacts: [prefetchImage(contactsContent.image, '(max-width: 768px) 100vw, 33vw')],
}

const typeImport = "import type * as Types from '../../content/types'\n"
await Promise.all([
  writeFile(path.join(OUT_DIR, 'site.ts'), `// AUTO-GENERATED.\n${typeImport}export const siteLogo: Types.SiteLogoData = ${JSON.stringify(siteLogo, null, 2)}\n`),
  writeFile(path.join(OUT_DIR, 'home.ts'), `// AUTO-GENERATED.\n${typeImport}export const homeContent: Types.HomeContent = ${JSON.stringify(homeContent, null, 2)}\n`),
  writeFile(path.join(OUT_DIR, 'works.ts'), `// AUTO-GENERATED.\n${typeImport}export const worksContent: Types.WorksContent = ${JSON.stringify(worksContent, null, 2)}\n`),
  writeFile(path.join(OUT_DIR, 'contacts.ts'), `// AUTO-GENERATED.\n${typeImport}export const contactsContent: Types.ContactsContent = ${JSON.stringify(contactsContent, null, 2)}\n`),
  writeFile(path.join(OUT_DIR, 'portraits.ts'), `// AUTO-GENERATED.\n${typeImport}export const album: Types.AlbumContent = ${JSON.stringify(portraits, null, 2)}\n`),
  writeFile(path.join(OUT_DIR, 'projects.ts'), `// AUTO-GENERATED.\n${typeImport}export const album: Types.AlbumContent = ${JSON.stringify(projects, null, 2)}\n`),
  writeFile(path.join(OUT_DIR, 'brands.ts'), `// AUTO-GENERATED.\n${typeImport}export const album: Types.AlbumContent = ${JSON.stringify(brands, null, 2)}\n`),
  writeFile(path.join(OUT_DIR, 'prefetch.ts'), `// AUTO-GENERATED.\nimport type { PageKey } from '../pages'\nexport interface PrefetchImageSpec { src: string; srcSet: string; sizes: string }\nexport const routePrefetch: Record<PageKey, PrefetchImageSpec[]> = ${JSON.stringify(routePrefetch, null, 2)}\n`),
  writeFile(MANIFEST, JSON.stringify([...assets].sort(), null, 2) + '\n'),
])

await rm(path.join(ROOT, 'src', 'generated', 'structured.ts'), { force: true })
console.log(`Generated split React data: works=${worksContent.cards.length}, home slides=${homeContent.cover.slides.length}, portraits=${portraits.photos.length}, projects=${projects.photos.length}, brands=${brands.photos.length}; ${assets.size} rendered assets selected.`)
