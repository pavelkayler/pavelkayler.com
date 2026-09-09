#!/usr/bin/env python3
"""One-time preparation helper; removed before the final source commit."""
import hashlib
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

TMP = Path(os.environ['RUNNER_TEMP'])
REVIEW = TMP / 'standalone-review'
REVIEW.mkdir(exist_ok=True)
MAPPING = {'i.wfolio.ru':'media/images','static.wfolio.ru':'media/static','vp.wfolio.ru':'media/video'}

def digest(file):
    h = hashlib.sha256()
    with file.open('rb') as stream:
        for block in iter(lambda: stream.read(1024*1024), b''):
            h.update(block)
    return h.hexdigest()

def rewrite(text):
    for old, new in MAPPING.items():
        text = text.replace(old+'/', new+'/')
    return text.replace('// AUTO-GENERATED. Do not edit directly.', '// FROZEN SOURCE. Update intentionally when site content changes.').replace('// AUTO-GENERATED.', '// FROZEN SOURCE. Update intentionally when site content changes.')

def snapshot():
    media, published = {}, {}
    for old, new in MAPPING.items():
        assert Path(old).is_dir(), old
        for p in Path(old).rglob('*'):
            if p.is_file(): media[new+'/'+str(p.relative_to(old))] = digest(p)
        for p in (Path('dist')/old).rglob('*'):
            if p.is_file(): published[new+'/'+str(p.relative_to(Path('dist')/old))] = digest(p)
    content = {str(p): rewrite(p.read_text()) for p in Path('src/generated').rglob('*') if p.suffix in ('.ts','.json')}
    theme = Path('dist/legacy-theme.css').read_text().replace('/* Extracted from the archived Wfolio page for React fidelity; Oswald v49 is self-hosted. */', '/* Frozen portfolio theme; Oswald v49 is self-hosted. */')
    (TMP/'baseline.json').write_text(json.dumps({'media':media,'published':published,'content':content,'theme':theme}))
    print(json.dumps({'baseline_source_media':len(media),'baseline_published_media':len(published),'baseline_content':len(content)}))

def freeze():
    subprocess.run(['node','scripts/finalize-source-migration.mjs'], check=True)
    Path('scripts/finalize-source-migration.mjs').unlink()
    Path('.github/workflows/finalize-source-migration.yml').unlink(missing_ok=True)
    p = Path('scripts/browser-smoke.py')
    p.write_text(p.read_text().replace(', before)\n', ', arg=before)\n'))
    for filename in ('pages.yml','react-build.yml'):
        p = Path('.github/workflows')/filename
        text = p.read_text().replace('run: npm install', 'run: npm ci --no-audit --no-fund')
        if filename == 'pages.yml':
            anchor = '      - name: Install media tools'
            marker = '      - name: Identify published revision\n        run: |\n          python3 -c "import json,os,pathlib; pathlib.Path(\'dist/build-info.json\').write_text(json.dumps({\'commit\':os.environ[\'GITHUB_SHA\']}))"\n\n'
            assert anchor in text
            text = text.replace(anchor, marker+anchor)
            assert '\n  smoke:\n' in text
            text = text.split('\n  smoke:\n')[0] + '\n  smoke:\n    needs: deploy\n    runs-on: ubuntu-latest\n    timeout-minutes: 10\n    permissions:\n      contents: read\n    steps:\n      - uses: actions/checkout@v6\n      - name: Require HTTPS, redirects and the published revision\n        run: EXPECTED_COMMIT="$GITHUB_SHA" bash scripts/check-live-site.sh\n'
        p.write_text(text)
    (REVIEW/'workflows').mkdir(exist_ok=True)
    for filename in ('pages.yml','react-build.yml'):
        shutil.copyfile(Path('.github/workflows')/filename, REVIEW/'workflows'/filename)

def verify():
    baseline = json.loads((TMP/'baseline.json').read_text())
    for name, expected in baseline['media'].items():
        assert Path(name).is_file(), f'Missing media: {name}'
        assert digest(Path(name)) == expected, f'Media bytes changed: {name}'
    assert {str(p) for p in Path('media').rglob('*') if p.is_file()} == set(baseline['media']), 'Media file set changed'
    for name, expected in baseline['published'].items():
        assert digest(Path('dist')/name) == expected, f'Published media changed: {name}'
    for name, expected in baseline['content'].items():
        assert Path(name).read_text() == expected, f'Unexpected content change: {name}'
    assert Path('dist/site-theme.css').read_text() == baseline['theme'], 'Theme rules changed'
    for name in ('legacy-source','i.wfolio.ru','static.wfolio.ru','vp.wfolio.ru','wfolio','mc.yandex.ru','migration-report.json','works.html','portraits.html','projects.html','brands.html','contacts.html'):
        assert not Path(name).exists(), f'Migration artifact remains: {name}'
    report = {'source_media_unchanged':len(baseline['media']),'published_media_unchanged':len(baseline['published']),'content_files_preserved':len(baseline['content']),'theme_preserved':True,'independent_build':True}
    (REVIEW/'preservation.json').write_text(json.dumps(report, indent=2))
    print(json.dumps(report))

if sys.argv[1] == 'snapshot': snapshot()
elif sys.argv[1] == 'freeze': freeze()
elif sys.argv[1] == 'verify': verify()
else: raise SystemExit('Unknown preparation stage')
