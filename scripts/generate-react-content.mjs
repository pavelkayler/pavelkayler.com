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

await mkdir(OUT, { recursive: true })
const pages = {}

for (const [key, file, routePath] of pageDefs) {
  const html = await readFile(path.join(SOURCE, file), 'utf8')
  const $ = load(html, { decodeEntities: false })

  pages[key] = {
    key,
    path: routePath,
    title: $('title').text().trim() || 'Pavel Kayler | Photographer',
    description: $('meta[name="description"]').attr('content') || '',
    bodyClass: $('body').attr('class') || 'theme-polina',
    hasCover: $('.cover').first().length > 0,
  }
}

const ts = `// AUTO-GENERATED. Do not edit directly.\nexport type PageKey = 'home' | 'works' | 'portraits' | 'projects' | 'brands' | 'contacts'\nexport interface GeneratedPage {\n  key: PageKey\n  path: string\n  title: string\n  description: string\n  bodyClass: string\n  hasCover: boolean\n}\nexport const pages: Record<PageKey, GeneratedPage> = ${JSON.stringify(pages, null, 2)}\n`
await writeFile(path.join(OUT, 'pages.ts'), ts)
console.log(`Generated ${Object.keys(pages).length} React route metadata entries.`)
