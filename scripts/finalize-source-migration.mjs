#!/usr/bin/env node
import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

const ROOT = process.cwd()

async function replaceInFile(relative, transform) {
  const file = path.join(ROOT, relative)
  const before = await readFile(file, 'utf8')
  const after = transform(before)
  if (before === after) throw new Error(`Expected rewrite produced no changes: ${relative}`)
  await writeFile(file, after)
}

async function walk(directory, files = []) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name)
    if (entry.isDirectory()) await walk(full, files)
    else files.push(full)
  }
  return files
}

const pathRewrites = [
  ['i.wfolio.ru/', 'media/images/'],
  ['static.wfolio.ru/', 'media/static/'],
  ['vp.wfolio.ru/', 'media/video/'],
]

// Freeze the generated route/content layer that was previously reconstructed from HTML on every build.
for (const file of await walk(path.join(ROOT, 'src/generated'))) {
  if (!/\.(?:ts|json)$/.test(file)) continue
  let text = await readFile(file, 'utf8')
  for (const [from, to] of pathRewrites) text = text.replaceAll(from, to)
  text = text
    .replace('// AUTO-GENERATED. Do not edit directly.', '// FROZEN SOURCE. Update intentionally when site content changes.')
    .replace('// AUTO-GENERATED.', '// FROZEN SOURCE. Update intentionally when site content changes.')
  await writeFile(file, text)
}

// Freeze the site theme as a first-class source asset instead of extracting it from archived HTML.
await mkdir(path.join(ROOT, 'assets/styles'), { recursive: true })
let theme = await readFile(path.join(ROOT, 'dist/legacy-theme.css'), 'utf8')
theme = theme.replace(
  '/* Extracted from the archived Wfolio page for React fidelity; Oswald v49 is self-hosted. */',
  '/* Frozen portfolio theme; Oswald v49 is self-hosted. */',
)
await writeFile(path.join(ROOT, 'assets/styles/site-theme.css'), theme)

let responsive = await readFile(path.join(ROOT, 'assets/mobile-overrides.css'), 'utf8')
responsive = responsive
  .replace('Responsive overrides for the restored Wfolio Polina theme.', 'Responsive overrides for the portfolio theme.')
  .replace("Wfolio's col-sm widths", 'Legacy col-sm widths')
  .replace('Covers retain the Wfolio composition', 'Covers retain the original composition')
await writeFile(path.join(ROOT, 'assets/styles/responsive.css'), responsive)

// The media itself is ours; move it out of downloaded-hostname-shaped directories.
await mkdir(path.join(ROOT, 'media'), { recursive: true })
for (const [from, to] of [
  ['i.wfolio.ru', 'media/images'],
  ['static.wfolio.ru', 'media/static'],
  ['vp.wfolio.ru', 'media/video'],
]) {
  await rename(path.join(ROOT, from), path.join(ROOT, to))
}

await replaceInFile('package.json', (text) => {
  const pkg = JSON.parse(text)
  pkg.scripts.dev = 'vite'
  delete pkg.scripts.generate
  pkg.scripts.build = 'tsc -b && vite build && node scripts/copy-react-assets.mjs'
  return `${JSON.stringify(pkg, null, 2)}\n`
})

await replaceInFile('index.html', (text) => text
  .replace(
    '    <!-- Wfolio kept most of the Polina page/layout CSS inline in every HTML page.\n         copy-react-assets.mjs extracts that CSS into this standalone production file. -->\n    <link rel="stylesheet" href="%BASE_URL%legacy-theme.css" />',
    '    <!-- Site layout/theme CSS is frozen locally and shipped without builder/runtime dependencies. -->\n    <link rel="stylesheet" href="%BASE_URL%site-theme.css" />',
  )
  .replace('%BASE_URL%assets/mobile-overrides.css', '%BASE_URL%assets/styles/responsive.css')
)

await replaceInFile('scripts/copy-react-assets.mjs', (text) => {
  const start = text.indexOf("const oswaldRemoteBase = 'https://fonts.gstatic.com/s/oswald/v49/'")
  const marker = 'await copyVendoredOswald()'
  const end = text.indexOf(marker)
  if (start < 0 || end < 0 || end < start) throw new Error('Could not locate legacy theme extraction block')

  const replacement = `const oswaldLocalBase = 'assets/fonts/oswald/'\n\nasync function copyVendoredOswald() {\n  let bytes = 0\n  for (const filename of oswaldV49Files) {\n    const relativePath = \`${'${oswaldLocalBase}'}${'${filename}'}\`\n    const buffer = await readFile(path.join(ROOT, relativePath))\n    if (buffer.length < 1000 || buffer.subarray(0, 4).toString('ascii') !== 'wOF2') {\n      throw new Error(\`Invalid vendored WOFF2: ${'${relativePath}'} (${'${buffer.length}'} bytes)\`)\n    }\n    await copyAsset(relativePath)\n    bytes += buffer.length\n  }\n  await copyAsset(\`${'${oswaldLocalBase}'}OFL.txt\`)\n  console.log(\`Copied vendored Oswald v49: ${'${oswaldV49Files.length}'} WOFF2 files, ${'${(bytes / 1024).toFixed(1)}'} KiB.\`)\n}\n\nawait copyAssetTo('assets/styles/site-theme.css', 'site-theme.css')\n${marker}`

  const afterEnd = end + marker.length
  return (text.slice(0, start) + replacement + text.slice(afterEnd))
    .replace("'assets/mobile-overrides.css'", "'assets/styles/responsive.css'")
    .replace('// Ship only the legacy assets that the React shell and retained CSS can still use.\n// The archived Wfolio runtime JS, builder resources, locale flags, and unrelated assets\n// deliberately stay out of dist. Modern browsers use the WOFF2 Font Awesome sources,\n// so the legacy TTF fallbacks are intentionally not published.', '// Ship only runtime assets used by the React shell and retained theme CSS.\n// Builder resources and unrelated fallbacks stay out of dist.')
})

await replaceInFile('scripts/optimize-production-images.py', (text) =>
  text.replace('ROOT = Path("dist/i.wfolio.ru")', 'ROOT = Path("dist/media/images")')
)

function cleanWorkflow(text) {
  text = text
    .replaceAll('dist/legacy-theme.css', 'dist/site-theme.css')
    .replaceAll('assets/mobile-overrides.css', 'assets/styles/responsive.css')
    .replaceAll("{'i.wfolio.ru', 'static.wfolio.ru', 'vp.wfolio.ru'}", "{'media'}")
  text = text.replace(/\n      - name: Capture generated migration outputs[\s\S]*?retention-days: 1\n/, '\n')
  return text
}

await replaceInFile('.github/workflows/react-build.yml', (text) => {
  text = cleanWorkflow(text)
  const anchor = '          MAX_BYTES=$((850 * 1024 * 1024))'
  const checks = `          test ! -d legacy-source\n          test ! -d i.wfolio.ru\n          test ! -d static.wfolio.ru\n          test ! -d vp.wfolio.ru\n          test ! -d wfolio\n          test ! -d mc.yandex.ru\n          test ! -f migration-report.json\n          test ! -f works.html\n          test ! -f portraits.html\n          test ! -f projects.html\n          test ! -f brands.html\n          test ! -f contacts.html\n          test ! -f scripts/generate-react-content.mjs\n          test ! -f scripts/generate-structured-content.mjs\n          test -d media/images\n          test -d media/video\n          ! grep -R 'wfolio\\.ru/' src/generated scripts --include='*.ts' --include='*.json' --include='*.mjs' --include='*.py' || exit 1\n\n`
  if (!text.includes(anchor)) throw new Error('Validation workflow size anchor missing')
  return text.replace(anchor, checks + anchor)
})

await replaceInFile('.github/workflows/pages.yml', (text) => {
  text = cleanWorkflow(text)
  const anchor = '          MAX_BYTES=$((850 * 1024 * 1024))'
  const checks = `          test ! -d legacy-source\n          test ! -d i.wfolio.ru\n          test ! -d static.wfolio.ru\n          test ! -d vp.wfolio.ru\n          test ! -d wfolio\n          test ! -d mc.yandex.ru\n          test -d media/images\n          test -d media/video\n\n`
  if (!text.includes(anchor)) throw new Error('Pages workflow size anchor missing')
  return text.replace(anchor, checks + anchor)
})

// Remove migration-only sources now that content, metadata and theme are frozen.
for (const relative of [
  'legacy-source',
  'mc.yandex.ru',
  'wfolio',
  'migration-report.json',
  'works.html',
  'portraits.html',
  'projects.html',
  'brands.html',
  'contacts.html',
  'scripts/generate-react-content.mjs',
  'scripts/generate-structured-content.mjs',
  'scripts/migrate_wfolio.py',
  'scripts/apply_responsive.py',
  'scripts/validate_migration.py',
  'scripts/validate_responsive.py',
  '.github/workflows/migrate-wfolio.yml',
  '.github/workflows/validate-migration.yml',
  'assets/mobile-overrides.css',
  'assets/site-fixes.js',
  'assets/flags',
  'assets/folio/desktop/themes',
]) {
  await rm(path.join(ROOT, relative), { recursive: true, force: true })
}

// WOFF2 is the only font format shipped by the production CSS.
for (const name of await readdir(path.join(ROOT, 'assets/font-awesome'))) {
  if (name.endsWith('.ttf')) await rm(path.join(ROOT, 'assets/font-awesome', name), { force: true })
}

console.log('Source migration finalized: generated content frozen, media normalized, migration artifacts removed.')
