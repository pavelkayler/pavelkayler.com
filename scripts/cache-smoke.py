#!/usr/bin/env python3
"""Exercise a real HTTP cache across a stylesheet release change (no routing mocks)."""
import asyncio
from collections import Counter
from functools import partial
from html import escape
from html.parser import HTMLParser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import re
import threading
from urllib.parse import parse_qs, urlsplit
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / 'dist'
OUTPUT = ROOT / 'test-results/browser/cache'


class Assets(HTMLParser):
    def __init__(self):
        super().__init__()
        self.styles = []
        self.script = ''

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'link' and attrs.get('rel') == 'stylesheet':
            self.styles.append(attrs['href'])
        if tag == 'script' and attrs.get('type') == 'module':
            self.script = attrs.get('src', '')


async def exercise(browser, name, mobile, assets):
    width, height = (414, 896) if mobile else (1440, 1000)
    paths = [urlsplit(href).path for href in assets.styles if '/_app/' not in href]
    state = {'old': True, 'requests': []}
    seed = ''.join(f'<link rel="stylesheet" href="{escape(p)}">' for p in paths)
    seed = '<!doctype html><html><head>' + seed + '</head><body>Previous release cache</body></html>'

    class Handler(SimpleHTTPRequestHandler):
        def log_message(self, *args):
            pass

        def do_GET(self):
            state['requests'].append(self.path)
            url = urlsplit(self.path)
            if url.path.startswith('/__qa_css_cache_seed__'):
                self.send_body(seed.encode(), 'text/html', 'no-store')
            elif state['old'] and not url.query and url.path in paths:
                index = paths.index(url.path)
                body = f':root {{ --qa-stale-style-{index}: 1; }}'.encode()
                self.send_body(body, 'text/css', 'public, max-age=31536000')
            else:
                super().do_GET()

        def send_body(self, body, content_type, cache_control):
            self.send_response(200)
            self.send_header('Content-Type', content_type)
            self.send_header('Content-Length', str(len(body)))
            self.send_header('Cache-Control', cache_control)
            self.end_headers()
            self.wfile.write(body)

    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Handler, directory=str(DIST)))
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    base = f'http://127.0.0.1:{server.server_port}'
    context = await browser.new_context(viewport={'width': width, 'height': height},
                                        is_mobile=mobile, has_touch=mobile)
    page = await context.new_page()
    page.set_default_timeout(30000)
    failures = []
    page.on('pageerror', lambda error: failures.append(str(error)))
    page.on('response', lambda response: failures.append(f'{response.status} {response.url}')
            if response.status >= 400 and response.request.resource_type in
            ('image', 'stylesheet', 'script', 'font') else None)
    result = {'name': name, 'passed': False, 'checks': [], 'errors': []}
    try:
        # Two distinct documents load the same old CSS URLs. The second visit
        # must reuse the browser cache, not fetch the files from this server.
        for visit in (1, 2):
            await page.goto(base + f'/__qa_css_cache_seed__?visit={visit}')
            for index in range(len(paths)):
                value = await page.evaluate('(i) => getComputedStyle(document.documentElement).getPropertyValue(`--qa-stale-style-${i}`).trim()', index)
                assert value == '1', f'Old CSS not cached/applied for stylesheet {index}'
        counts = Counter(state['requests'])
        assert all(counts[p] == 1 for p in paths), f'Test did not exercise the browser cache: {counts}'
        result['checks'].append('Previous unversioned styles remain fresh in the real browser cache')
        result['old_stylesheet_requests'] = {p: counts[p] for p in paths}

        state['old'] = False
        await page.goto(base + '/')
        await page.locator('.page-header').wait_for(state='visible')
        await page.evaluate('document.fonts.ready')
        await page.wait_for_function("document.querySelector('.logo-image')?.naturalWidth > 0")
        await page.wait_for_function("[...document.fonts].some(f => f.family.replaceAll('\"', '') === 'Oswald' && f.status === 'loaded')")
        await page.wait_for_function("document.getElementById('site-loader')?.classList.contains('is-hidden') || !document.getElementById('site-loader')")
        for index in range(len(paths)):
            value = await page.evaluate('(i) => getComputedStyle(document.documentElement).getPropertyValue(`--qa-stale-style-${i}`).trim()', index)
            assert value == '', f'Stale cached stylesheet {index} leaked into the new page'
        for href in assets.styles:
            url = urlsplit(href)
            assert url.path + '?' + url.query in state['requests'], f'New stylesheet not fetched: {href}'
        await page.screenshot(path=str(OUTPUT / f'{name}-updated-home.png'), animations='disabled')
        assert not failures, failures
        result['checks'].append('New release fetches new CSS; renamed fonts and logo load without clearing cache')
        result['passed'] = True
    except Exception as error:
        result['errors'] = failures + [str(error)]
        await page.screenshot(path=str(OUTPUT / f'{name}-failure.png'), animations='disabled')
    finally:
        result['stylesheet_requests'] = [p for p in state['requests'] if urlsplit(p).path.endswith('.css')]
        await context.close()
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)
    return result


async def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    assets = Assets()
    assets.feed((DIST / 'index.html').read_text())
    match = re.search(r'/_app/(release-\d+-\d+|local)/site\.js$', assets.script)
    assert match, f'Missing versioned JS entry: {assets.script}'
    release = match[1]
    # Vite combines layout/responsive/app CSS. Only the manually copied theme
    # keeps its old pathname; verify both groups rather than the source link count.
    style_paths = [urlsplit(href).path for href in assets.styles]
    assert any(p.endswith('/site-theme.css') for p in style_paths), 'Copied theme missing'
    assert any(f'/_app/{release}/' in p and p.endswith('.css') for p in style_paths), 'Versioned CSS bundle missing'
    for file in DIST.rglob('*.html'):
        document = Assets()
        document.feed(file.read_text())
        assert document.styles, f'No stylesheets in {file}'
        assert all(parse_qs(urlsplit(href).query).get('release') == [release]
                   for href in document.styles), f'Unversioned/mismatched CSS in {file}'
    results = []
    async with async_playwright() as tool:
        for engine, name, mobile in ((tool.chromium, 'chromium-desktop', False),
                                     (tool.webkit, 'webkit-mobile', True)):
            browser = await engine.launch()
            try:
                result = await exercise(browser, name, mobile, assets)
                results.append(result)
                print(json.dumps(result, ensure_ascii=False), flush=True)
            finally:
                await browser.close()
    (OUTPUT / 'report.json').write_text(json.dumps({'release': release, 'results': results}, indent=2))
    raise SystemExit(0 if all(result['passed'] for result in results) else 1)


if __name__ == '__main__':
    asyncio.run(main())
