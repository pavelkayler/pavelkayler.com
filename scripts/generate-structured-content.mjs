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

const worksHtml = await readFile(path.join(SOURCE, 'works.html'), 'utf8')
const $works = load(worksHtml, { decodeEntities: false })
const logoImage = $works('.logo .logo-image').first()

const siteLogo = {
  src: localize(logoImage.attr('data-src') || logoImage.attr('src') || ''),
  alt: logoImage.attr('alt') || 'pavelkayler.com',
  maxWidth: 209,
  maxHeight: 35,
}

const worksCards = $works('.listing .listing-item').map((_, element) => {
  const item = $works(element)
  const link = item.find('a.listing-link').first()
  const href = link.attr('href') || '/'
  return {
    to: routeMap.get(href) || href,
    title: item.find('.listing-title').text().trim(),
    image: imageData($works, item.find('.lazy-image').first()),
  }
}).get()

const worksQuote = $works('.-listing-postfix blockquote p').map((_, element) =>
  $works(element).text().replace(/\s+/g, ' ').trim(),
).get()

const contactsHtml = await readFile(path.join(SOURCE, 'contacts.html'), 'utf8')
const $contacts = load(contactsHtml, { decodeEntities: false })
const contactImageNode = $contacts('.picture-section .lazy-image').first()
const contactText = $contacts('.text-section').filter((_, element) => $contacts(element).find('h1').length > 0).first()
const contactAction = $contacts('.action-section a.button').first()

const contacts = {
  image: imageData($contacts, contactImageNode),
  heading: contactText.find('h1').text().replace(/\s+/g, ' ').trim(),
  text: contactText.find('p').first().text().replace(/\s+/g, ' ').trim(),
  actionHref: contactAction.attr('href') || 'https://t.me/pavelkayler',
  actionLabel: contactAction.text().replace(/\s+/g, ' ').trim(),
}

const output = `// AUTO-GENERATED from legacy-source. Do not edit directly.\n\nexport interface StructuredImage {\n  src: string\n  srcSet: string\n  alt: string\n  width: number\n  height: number\n  aspect: number\n  placeholderWidth: number\n  placeholderHeight: number\n  placeholderColor: string\n}\n\nexport interface WorksCard {\n  to: string\n  title: string\n  image: StructuredImage\n}\n\nexport const siteLogo = ${JSON.stringify(siteLogo, null, 2)} as const\n\nexport const worksContent = ${JSON.stringify({ cards: worksCards, quote: worksQuote }, null, 2)} as const\n\nexport const contactsContent = ${JSON.stringify(contacts, null, 2)} as const\n`

await writeFile(OUT, output)
console.log(`Generated native React data: ${worksCards.length} works cards + contacts page.`)
