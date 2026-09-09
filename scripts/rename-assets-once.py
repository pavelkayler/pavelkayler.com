#!/usr/bin/env python3
"""One-time byte-preserving rename; removed before merging the reviewed result."""
from collections import Counter, defaultdict
import csv
import hashlib
import io
import json
from pathlib import Path
import posixpath
import re
import subprocess
from PIL import Image

root = Path.cwd()
inventory = []
for name in filter(None, subprocess.check_output(['git', 'ls-files', '-z']).decode().split('\0')):
    p = root / name
    data = p.read_bytes()
    item = {'path': name, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}
    if name.startswith('media/images/') or p.suffix.lower() in ('.png', '.jpg', '.jpeg', '.ico'):
        with Image.open(p) as image:
            item['size'] = list(image.size)
    inventory.append(item)
by_path = {item['path']: item for item in inventory}
mapping = {}
roles = defaultdict(set)
allocated = set(by_path)

def assign(old, new, purpose):
    if old not in by_path:
        raise ValueError(f'Unknown source: {old}')
    roles[old].add(purpose)
    if old in mapping:
        return
    if new != old and new in allocated:
        base, ext = posixpath.splitext(new)
        number = 2
        while f'{base}-variant-{number}{ext}' in allocated:
            number += 1
        new = f'{base}-variant-{number}{ext}'
    mapping[old] = new
    allocated.add(new)

def local(value):
    return value.replace('__BASE__', '').lstrip('/')

def image_path(old, stem, purpose):
    old = local(old)
    size = by_path[old].get('size')
    if size is None:
        raise ValueError(f'Image has no actual dimensions: {old}')
    ext = '.png' if '.png' in old else '.jpg'
    assign(old, f'{stem}-{size[0]}x{size[1]}{ext}', purpose)

def image_group(image, stem, purpose):
    paths = [image['src']]
    for value in image.get('srcSet', '').split(','):
        if value.strip():
            paths.append(value.strip().split()[0])
    for old in dict.fromkeys(paths):
        image_path(old, stem, purpose)

def model(name):
    text = (root / f'src/generated/content/{name}.ts').read_text()
    return json.loads(text[text.index('= {') + 2:])

home = model('home')
albums = {key: model(key) for key in ('portraits', 'projects', 'brands')}
logo = model('site')
assign(local(logo['src']), 'media/images/branding/pavel-kayler-logo.png', 'Site logo')
social = json.loads((root / 'src/generated/social-images.json').read_text())
social_uses = Counter(item['source'] for item in social)
for item in social:
    key = Path(item['target']).stem if social_uses[item['source']] == 1 else 'site'
    image_path(item['source'], f'media/images/social/{key}-social-preview', f'Social preview: {Path(item["target"]).stem}')
for index, image in enumerate(home['cover']['slides'], 1):
    image_group(image, f'media/images/home/hero-slide-{index:02}', f'Home hero slide {index}')
for index, column in enumerate((column for row in home['pictureRows'] for column in row['columns']), 1):
    image_group(column['image'], f'media/images/home/home-photo-{index:02}', f'Home photograph {index}')
for key, album in albums.items():
    if album['cover']:
        cover = album['cover']
        image_path(cover['poster'], f'media/images/{key}/{key}-cover-poster', f'{key}: video poster')
        assign(local(cover['videoSrc']), f'media/video/{key}-cover.mp4', f'{key}: cover video')
    for index, photo in enumerate(album['photos'], 1):
        stem = f'media/images/{key}/{key}-photo-{index:03}'
        image_group(photo['image'], stem, f'{key}: photograph {index}')
        image_path(photo['fullscreenSrc'], stem, f'{key}: photograph {index}, viewer')
for card in model('works')['cards']:
    key = card['to'].strip('/')
    image_group(card['image'], f'media/images/navigation/{key}-category-card', f'Navigation card: {key}')
image_group(model('contacts')['image'], 'media/images/contacts/photographer-portrait', 'Contacts portrait')
for card in home['works']:
    image_group(card['image'], f'media/images/navigation/{card["to"].strip("/")}-category-card', 'Home category navigation')
for key, album in albums.items():
    for card in album['related']:
        image_group(card['image'], f'media/images/navigation/{card["to"].strip("/")}-category-card', f'{key}: related category navigation')
manifest = json.loads((root / 'src/generated/asset-manifest.json').read_text())
missing = sorted(set(manifest) - set(mapping))
assert not missing, f'Published assets without an identified purpose: {missing}'
active_sources = set(mapping)
active_by_sha = {by_path[old]['sha256']: old for old in mapping}
retained_count = 0
copy_counts = Counter()
for item in inventory:
    old = item['path']
    if not old.startswith('media/') or old in mapping:
        continue
    same = active_by_sha.get(item['sha256'])
    if same:
        stem = Path(mapping[same]).stem
        copy_counts[stem] += 1
        ext = Path(mapping[same]).suffix
        assign(old, f'media/archive/duplicates/{stem}-retained-copy-{copy_counts[stem]:02}{ext}', 'Unpublished identical copy')
    else:
        retained_count += 1
        image_path(old, f'media/archive/images/retained-photo-{retained_count:03}', 'Unpublished retained photograph or image variant')

theme = (root / 'assets/styles/site-theme.css').read_text()
for match in re.finditer(r'/\*\s*(cyrillic-ext|cyrillic|vietnamese|latin-ext|latin)\s*\*/\s*(@font-face\s*\{[^}]+\})', theme):
    subset, face = match.groups()
    weight = re.search(r'font-weight:\s*(\d+)', face).group(1)
    source = re.search(r'url\("([^"]+)"\)', face).group(1)
    assign(source, f'assets/fonts/oswald/oswald-{weight}-{subset}.woff2', f'Oswald {weight}, {subset}')
for old in by_path:
    name = Path(old).name
    if old.startswith('assets/font-awesome/'):
        match = re.fullmatch(r'fa-(brands-400|light-300|solid-900)-[a-f0-9]+\.(woff2|ttf)', name)
        assert match, old
        assign(old, f'assets/fonts/font-awesome/fontawesome-{match[1]}.{match[2]}', f'Font Awesome {match[1]}')
    elif old.startswith('assets/custom-icons-'):
        assign(old, 'assets/fonts/site-icons.woff2', 'Site icon font')
    elif old.startswith('assets/icons/'):
        descriptive = re.sub(r'-[0-9a-f]{64}(?=\.)', '', name).replace('_', '-')
        assign(old, f'assets/icons/{descriptive}', 'Interface icon')
    elif old.startswith('assets/folio/'):
        assert name.startswith('polina-') and name.endswith('.css'), old
        assign(old, 'assets/styles/portfolio-layout.css', 'Portfolio layout and icon styles')
for old in by_path:
    if not old.startswith('src/generated/'):
        continue
    tail = old.removeprefix('src/generated/')
    destinations = {
        'asset-manifest.json': 'media-manifest.json',
        'pages.json': 'page-metadata.json', 'pages.ts': 'page-metadata.ts',
        'social-images.json': 'social-images.json',
        'content/site.ts': 'site.ts', 'content/prefetch.ts': 'prefetch.ts',
    }
    target = destinations.get(tail, tail.replace('content/', 'pages/'))
    assign(old, 'src/content/' + target, 'Maintained site content')
report_dir = Path('/tmp/descriptive-asset-names')
report_dir.mkdir(exist_ok=True)
(report_dir / 'rename-map.json').write_text(json.dumps(mapping, indent=2))
summary = {
    'baseline': '104e8f656b8a21e88418ad5f13945e18efeca7e2',
    'renamed_files': sum(old != new for old, new in mapping.items()),
    'media_files': sum(old.startswith('media/') for old in mapping),
    'published_manifest_files': len(manifest),
    'active_media_including_social': len(active_sources),
    'retained_media': sum(new.startswith('media/archive/') for new in mapping.values()),
    'retained_identical_copies': sum(copy_counts.values()),
    'malformed_old_paths': sum('"' in old for old in mapping),
    'maximum_old_path_length': max(map(len, mapping)),
    'maximum_new_path_length': max(map(len, mapping.values())),
}
print(json.dumps(summary, indent=2))
texts = {}
for old in by_path:
    if old.startswith('media/') or Path(old).suffix.lower() in ('.woff2', '.woff', '.ttf', '.eot', '.ico', '.png', '.jpg'):
        continue
    try:
        texts[old] = (root / old).read_text()
    except UnicodeDecodeError:
        pass
for old, new in mapping.items():
    if old == new:
        continue
    destination = root / new
    assert not destination.exists(), f'Would overwrite: {new}'
    destination.parent.mkdir(parents=True, exist_ok=True)
    (root / old).rename(destination)
url_pattern = re.compile(r'url\(\s*([\'"]?)([^\'"\)]+)\1\s*\)')
import_pattern = re.compile(r'((?:from\s+|import\s+)[\'"])(\.[^\'"]+)([\'"])')
replacements = sorted(mapping.items(), key=lambda pair: len(pair[0]), reverse=True)
basename_counts = Counter(Path(old).name for old in mapping)
basename_map = {Path(old).name: Path(new).name for old, new in mapping.items()
                if basename_counts[Path(old).name] == 1 and Path(old).name != Path(new).name}
removed_flag_rules = 0
transient = ('/rename-assets-once.py', '/filename-audit.yml', '/apply-asset-names.yml')
for old, text in texts.items():
    if old.endswith(transient):
        continue
    new = mapping.get(old, old)
    if old.endswith('.css'):
        # Only obsolete country-picker flag-image rules reference these absent files.
        text, count = re.subn(r'[^{}]+\{[^{}]*url\([^)]*assets/flags/[^)]*\)[^{}]*\}', '', text)
        removed_flag_rules += count
        old_dir = '' if old == 'assets/styles/site-theme.css' else posixpath.dirname(old)
        new_dir = '' if old == 'assets/styles/site-theme.css' else posixpath.dirname(new)
        def rewrite_url(match):
            uri = match[2].strip()
            if uri.startswith(('data:', 'http:', 'https:', '//', '#')):
                return match[0]
            asset = posixpath.normpath(posixpath.join(old_dir, uri)) if not uri.startswith('/') else uri.lstrip('/')
            if asset in mapping:
                target = mapping[asset]
                value = '/' + target if uri.startswith('/') else posixpath.relpath(target, new_dir or '.')
                return 'url("' + value + '")'
            return match[0]
        text = url_pattern.sub(rewrite_url, text)
    def rewrite_import(match):
        resolved = posixpath.normpath(posixpath.join(posixpath.dirname(old), match[2]))
        for ext in ('', '.ts', '.tsx', '.css', '.json'):
            target = resolved + ext
            if target in by_path:
                destination = mapping.get(target, target)
                value = posixpath.relpath(destination, posixpath.dirname(new))
                if ext:
                    value = value[:-len(ext)]
                if not value.startswith('.'):
                    value = './' + value
                return match[1] + value + match[3]
        return match[0]
    text = import_pattern.sub(rewrite_import, text)
    for before, after in replacements:
        text = text.replace(before, after)
    for before, after in basename_map.items():
        text = text.replace(before, after)
    text = text.replace('src/generated', 'src/content').replace('GeneratedPage', 'PageMetadata')
    text = text.replace('// FROZEN SOURCE. Update intentionally when site content changes.', '// Maintained site content. Update paths and dimensions together.')
    (root / new).write_text(text)
(root / 'vite.config.ts').write_text("""import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Each Pages run gets readable filenames in a new cache-safe release directory.
const release = process.env.GITHUB_RUN_NUMBER
const assetDirectory = release
  ? `_app/release-${release}-${process.env.GITHUB_RUN_ATTEMPT || '1'}`
  : '_app/local'

export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE_PATH || '/',
  build: {
    assetsDir: assetDirectory,
    sourcemap: false,
    minify: 'esbuild',
    target: 'es2020',
    rollupOptions: {
      output: {
        entryFileNames: `${assetDirectory}/site.js`,
        chunkFileNames: `${assetDirectory}/[name].js`,
        assetFileNames: `${assetDirectory}/[name][extname]`,
      },
    },
  },
})
""")
readme = (root / 'README.md').read_text()
start, end = readme.index('## Где находятся данные'), readme.index('При добавлении фотографии')
readme = readme[:start] + '''## Где находятся данные

- `src/content/pages/` — поддерживаемые данные главной, контактов и галерей.
- `src/content/site.ts` — логотип; `prefetch.ts` — предварительная загрузка.
- `src/content/page-metadata.json` и `page-metadata.ts` — метаданные страниц.
- `src/content/media-manifest.json` — полный список публикуемых медиа.
- `src/content/social-images.json` — изображения предпросмотра ссылок.
- `media/images/` — фотографии по разделам, обложки, навигация и логотип.
- `media/video/` — видеообложки `portraits-cover.mp4` и `projects-cover.mp4`.
- `media/archive/` — неиспользуемые сохранённые изображения; в сборку не копируются.
- `media/catalog.csv` — перечень медиа, назначение, размеры и статус публикации.
- `assets/fonts/` и `assets/icons/` — шрифты и иконки с описательными именами.
- `assets/styles/portfolio-layout.css`, `site-theme.css`, `responsive.css` — оформление.

Имена изображений: раздел, роль/номер кадра и реальные размеры файла, например
`portraits-photo-001-1920x2735.jpg`. Номер — постоянный идентификатор кадра, а не
указание переименовывать весь альбом при перестановке фотографий. У разных размеров
одного кадра один префикс. Общий файл не дублируется ради другого места использования.
Резервные файлы не получают выдуманных названий съёмок: их назначение отмечено в каталоге.

В production скрипты и стили имеют читаемые имена в `_app/release-<номер>-<попытка>/`.
Номер выпуска меняет URL при новой публикации, чтобы не смешивать старый и новый код.
Локальные сборки используют `_app/local/`.

''' + readme[end:]
(root / 'README.md').write_text(readme)
catalog = io.StringIO()
writer = csv.writer(catalog)
writer.writerow(['path', 'purpose', 'width', 'height', 'bytes', 'published'])
for old in sorted((old for old in mapping if old.startswith('media/')), key=lambda old: mapping[old]):
    item = by_path[old]
    size = item.get('size', ['', ''])
    writer.writerow([mapping[old], '; '.join(sorted(roles[old])), *size, item['bytes'], 'yes' if old in active_sources else 'no'])
(root / 'media/catalog.csv').write_text(catalog.getvalue())
(root / 'media/README.md').write_text('''# Медиатека

`images/home`, `images/portraits`, `images/projects`, `images/brands`,
`images/contacts` — изображения страниц; `images/navigation` — карточки разделов;
`images/branding` — логотип; `images/social` — исходники предпросмотра ссылок.
В `video` находятся две видеообложки.

Имена фотографий содержат назначение, стабильный номер кадра и фактические размеры
в пикселях. Все варианты одного кадра имеют общий префикс. Название раздела означает
место использования, а не жанр или автора изображения.

`archive/images` сохраняет неиспользуемые фотографии и варианты; `archive/duplicates`
сохраняет побайтные копии рабочих изображений. Ничего из архива автоматически не
публикуется. Удаление не выполнялось: переименование не должно терять исходники.

`catalog.csv` содержит полный перечень на момент упорядочивания. При изменении
медиатеки обновляйте каталог и `src/content/media-manifest.json`, а при изменении
контента — данные в `src/content/pages`. Не возвращайте случайные имена загрузок.
''')
gate = root / 'scripts/validate-production.sh'
gate.write_text(gate.read_text().replace("echo 'Production structure", "python3 scripts/validate-file-names.py --include-dist\necho 'Production structure"))
verified = 0
for old, new in mapping.items():
    if old.startswith('media/') or Path(old).suffix.lower() in ('.woff2', '.ttf', '.png'):
        actual = hashlib.sha256((root / new).read_bytes()).hexdigest()
        assert actual == by_path[old]['sha256'], f'Binary content changed: {new}'
        verified += 1
for folder in sorted((p for p in root.rglob('*') if p.is_dir() and '.git' not in p.parts), key=lambda p: len(p.parts), reverse=True):
    if not any(folder.iterdir()):
        folder.rmdir()
for old in texts:
    if old.endswith(transient):
        continue
    destination = root / mapping.get(old, old)
    text = destination.read_text()
    for before, after in mapping.items():
        if before != after:
            assert before not in text, f'Old path remains in {destination}: {before}'
    assert not re.search(r'[a-f0-9]{32,}\.(?:png|jpg|woff2|ttf|css|svg)', text), f'Opaque filename reference: {destination}'
# Verify all content models after reversing path substitutions. No layout,
# caption, photo order, dimensions or metadata may change during this rename.
content_models = 0
reverse_paths = sorted(((new, old) for old, new in mapping.items()), key=lambda pair: len(pair[0]), reverse=True)
for old, original in texts.items():
    if not old.startswith('src/generated/'):
        continue
    changed = (root / mapping[old]).read_text()
    for new_path, old_path in reverse_paths:
        changed = changed.replace(new_path, old_path)
    if old.endswith('.json'):
        assert json.loads(original) == json.loads(changed), f'Model changed: {old}'
    else:
        assert json.loads(original[original.index('= {') + 2:]) == json.loads(changed[changed.index('= {') + 2:]), f'Model changed: {old}'
    content_models += 1
summary['verified_unchanged_content_models'] = content_models
summary['verified_unchanged_binary_files'] = verified
summary['removed_unused_flag_rules'] = removed_flag_rules
summary['new_files'] = ['media/README.md', 'media/catalog.csv', 'scripts/validate-file-names.py']
(report_dir / 'summary.json').write_text(json.dumps(summary, indent=2))
print(json.dumps(summary, indent=2))
