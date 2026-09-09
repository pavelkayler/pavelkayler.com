#!/usr/bin/env node
/** Give copied styles the same readable release identifier as the JS entry. */
import { readFile, readdir, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { load } from 'cheerio'

const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist')
const origin = 'https://pavelkayler.com'

async function versionDirectory(directory) {
  let count = 0
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      count += await versionDirectory(file)
      continue
    }
    if (!entry.name.endsWith('.html')) continue
    const $ = load(await readFile(file, 'utf8'))
    const script = $('script[type="module"][src]').attr('src') || ''
    const match = new URL(script, origin).pathname.match(/^(.*)\/_app\/(release-\d+-\d+|local)\/site\.js$/)
    if (!match) throw new Error(`Missing readable release entry in ${file}: ${script}`)
    const [, basePath, release] = match
    const links = $('link[rel="stylesheet"][href]').toArray()
    if (!links.length) throw new Error(`No stylesheets in ${file}`)
    for (const link of links) {
      const url = new URL($(link).attr('href'), origin)
      if (url.origin !== origin) throw new Error(`External stylesheet in ${file}: ${url}`)
      if (!url.pathname.startsWith(`${basePath}/`)) throw new Error(`Stylesheet outside base path: ${url}`)
      const relative = decodeURIComponent(url.pathname.slice(basePath.length + 1))
      const target = path.resolve(dist, relative)
      if (!target.startsWith(`${dist}${path.sep}`) || !(await stat(target)).isFile()) {
        throw new Error(`Missing stylesheet in ${file}: ${relative}`)
      }
      // Keep descriptive filenames and CSS-relative URLs unchanged. A new query
      // makes the browser fetch this release rather than a cached earlier theme.
      url.searchParams.set('release', release)
      $(link).attr('href', `${url.pathname}${url.search}${url.hash}`)
    }
    await writeFile(file, $.html())
    count += 1
  }
  return count
}
console.log(`Versioned stylesheets in ${await versionDirectory(dist)} HTML pages.`)
