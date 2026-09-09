#!/usr/bin/env bash
# Shared structural gate for pull requests and the exact Pages artifact.
set -euo pipefail
for file in index.html 404.html site-theme.css robots.txt sitemap.xml; do test -s "dist/$file"; done
test -d dist/_app
for route in works portraits projects brands contacts; do
  test -s "dist/$route/index.html"
  grep -q "https://pavelkayler.com/$route/" "dist/$route/index.html"
done
grep -q 'https://pavelkayler.com/' dist/index.html
grep -q 'ПОРТРЕТЫ | PAVEL KAYLER' dist/portraits/index.html
grep -q 'name="description"' dist/brands/index.html
grep -q 'name="twitter:card"' dist/works/index.html
grep -q 'property="og:image"' dist/projects/index.html
grep -q '<loc>https://pavelkayler.com/works/</loc>' dist/sitemap.xml
! grep -q '\.html</loc>' dist/sitemap.xml
grep -q 'Sitemap: https://pavelkayler.com/sitemap.xml' dist/robots.txt
grep -q 'Страница не найдена | PAVEL KAYLER' dist/404.html
grep -q 'noindex, nofollow' dist/404.html
! grep -q 'rel="canonical"' dist/404.html
! grep -q 'property="og:image"' dist/404.html
! grep -q 'data-seo-schema' dist/404.html
grep -q 'NotFoundPage' src/app/router.tsx
! grep -q '<Navigate' src/app/router.tsx

test -d dist/assets/social
test "$(find dist/assets/social -type f | wc -l)" -eq 6
grep -q 'page-header' dist/site-theme.css
grep -q '\.cover' dist/site-theme.css
test -s dist/assets/styles/responsive.css
test -s dist/assets/folio/desktop/vendor/polina-3994a6f8acd9e18fe38b14dbbad877484965df0633ca7776ab996d2430e39a9f.css
test -s dist/assets/custom-icons-cb5906d824b59115b50c97eba5c0ee88aa5a4acb1a3af5a672f988e36a617629.woff2
test -s dist/assets/font-awesome/fa-light-300-e773295f27b81341e6948427170f7e29e2efac0aa00f9288185dc22da580ee56.woff2
test ! -d dist/assets/flags
test ! -d dist/assets/folio/desktop/themes
if find dist/assets -type f -name '*.js' -print -quit | grep -q .; then
  echo 'Unexpected builder JavaScript shipped under dist/assets' >&2
  exit 1
fi
test "$(find dist/assets/fonts/oswald -type f -name '*.woff2' | wc -l)" -eq 10
grep -q 'assets/fonts/oswald/' dist/site-theme.css
python3 - <<'PY'
from pathlib import Path
import json, re
patterns = [(re.compile(r"(?i)(?:https?:)?//[^\"'\s)>]*wfolio\.ru"), 'remote builder'), (re.compile(r'(?i)fonts\.(?:gstatic|googleapis)\.com'), 'remote font')]
for suffix in ('*.html','*.css','*.js'):
    for file in Path('dist').rglob(suffix):
        text = file.read_text('utf-8', errors='ignore')
        for pattern, label in patterns:
            assert not pattern.search(text), f'{label} dependency remains: {file}'
manifest = json.loads(Path('src/generated/asset-manifest.json').read_text())
for relative in manifest:
    assert not Path(relative).is_absolute() and '..' not in Path(relative).parts, f'Unsafe asset path: {relative}'
    assert Path(relative).is_file(), f'Source asset missing: {relative}'
    assert (Path('dist')/relative).is_file(), f'Published asset missing: {relative}'
print(f'All {len(manifest)} manifest assets exist locally and in production')
PY

test ! -f src/components/LegacyPage.tsx
test ! -f src/generated/structured.ts
! grep -R 'dangerouslySetInnerHTML' src --include='*.ts' --include='*.tsx'
! grep -R 'generated/structured' src --include='*.ts' --include='*.tsx'
! grep -q 'html: string' src/generated/pages.ts
grep -q 'applyPageMetadata' src/layouts/MainLayout.tsx
for path in legacy-source i.wfolio.ru static.wfolio.ru vp.wfolio.ru wfolio mc.yandex.ru migration-report.json works.html portraits.html projects.html brands.html contacts.html scripts/generate-react-content.mjs scripts/generate-structured-content.mjs; do
  test ! -e "$path"
done
test -d media/images
test -d media/video
! grep -R 'wfolio\.ru/' src/generated scripts --include='*.ts' --include='*.json' --include='*.mjs' --include='*.py'
MAX_BYTES=$((850 * 1024 * 1024))
ACTUAL_BYTES=$(du -sb dist | cut -f1)
echo "Production size: $ACTUAL_BYTES bytes (budget: $MAX_BYTES bytes)"
if (( ACTUAL_BYTES > MAX_BYTES )); then echo 'Production exceeds the 850 MiB budget' >&2; exit 1; fi
echo 'Production structure, content, SEO, asset completeness and budget passed.'
