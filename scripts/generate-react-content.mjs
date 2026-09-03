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

const descriptionFallbacks = {
  brands: 'Коммерческие и имиджевые съемки для брендов в портфолио Павла Кайлера: визуальные истории, портреты и проекты с вниманием к стилю и деталям.',
}

function normalizeLocalAsset(value = '') {
  const normalized = value
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^\/\//, '')
    .replace(/^\/+/, '')
  return /^(?:i\.wfolio\.ru|static\.wfolio\.ru|vp\.wfolio\.ru|assets)\//.test(normalized)
    ? normalized
    : ''
}

function socialTarget(key, sourcePath) {
  const cleanPath = sourcePath.replace(/[?#].*$/, '')
  const extension = path.extname(cleanPath).toLowerCase() || '.jpg'
  return `assets/social/${key}${extension}`
}

await mkdir(OUT, { recursive: true })
const pages = {}
const socialImages = []

for (const [key, file, routePath] of pageDefs) {
  const html = await readFile(path.join(SOURCE, file), 'utf8')
  const $ = load(html, { decodeEntities: false })
  const sourceSocialImage = normalizeLocalAsset(
    $('meta[property="og:image"]').attr('content') || $('meta[name="twitter:image"]').attr('content') || '',
  )
  const targetSocialImage = sourceSocialImage ? socialTarget(key, sourceSocialImage) : ''

  if (sourceSocialImage) {
    socialImages.push({ source: sourceSocialImage, target: targetSocialImage })
  }

  pages[key] = {
    key,
    path: routePath,
    title: $('title').text().trim() || 'Pavel Kayler | Photographer',
    description:
      $('meta[name="description"]').attr('content')?.trim() ||
      descriptionFallbacks[key] ||
      'Фотография Павла Кайлера: портреты, творческие проекты и коммерческие съемки.',
    socialImage: targetSocialImage ? `/${targetSocialImage}` : '',
    bodyClass: $('body').attr('class') || 'theme-polina',
    hasCover: $('.cover').first().length > 0,
  }
}

const ts = `// AUTO-GENERATED. Do not edit directly.\nexport type PageKey = 'home' | 'works' | 'portraits' | 'projects' | 'brands' | 'contacts'\nexport interface GeneratedPage {\n  key: PageKey\n  path: string\n  title: string\n  description: string\n  socialImage: string\n  bodyClass: string\n  hasCover: boolean\n}\nexport const pages: Record<PageKey, GeneratedPage> = ${JSON.stringify(pages, null, 2)}\n`

await Promise.all([
  writeFile(path.join(OUT, 'pages.ts'), ts),
  writeFile(path.join(OUT, 'pages.json'), JSON.stringify(pages, null, 2) + '\n'),
  writeFile(path.join(OUT, 'social-images.json'), JSON.stringify(socialImages, null, 2) + '\n'),
])

console.log(
  `Generated ${Object.keys(pages).length} React route metadata entries and ${socialImages.length} self-hosted social images.`,
)
