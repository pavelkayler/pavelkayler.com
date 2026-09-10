#!/usr/bin/env python3
"""Require complete albums before reveal, using real HTTP bytes/cache and late-file delays."""
import asyncio
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import re
import threading
import time
from urllib.parse import urlsplit
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / 'test-results/browser/complete-albums'


def album_data(route):
    source = (ROOT / f'src/content/pages/{route}.ts').read_text()
    return json.JSONDecoder().raw_decode(source.split('= ', 1)[1].lstrip())[0]


class AlbumServer:
    def __init__(self, route, failure=False):
        self.album = album_data(route)
        self.tail = re.search(r'/([^/]+-photo-\d+)-', self.album['photos'][-1]['image']['src'])[1]
        self.requests = []
        self.requested = threading.Event()
        self.release = threading.Event()
        self.failure = failure
        if failure:
            self.release.set()
        owner = self

        class Handler(SimpleHTTPRequestHandler):
            def log_message(self, *args):
                pass

            def end_headers(self):
                self.send_header('Cache-Control', 'no-store' if getattr(self, 'failed', False)
                                 else 'public, max-age=86400')
                super().end_headers()

            def do_GET(self):
                path = urlsplit(self.path).path
                owner.requests.append((time.monotonic(), path))
                if owner.tail + '-' in path:
                    owner.requested.set()
                    if owner.failure:
                        self.failed = True
                        self.send_error(503, 'Intentionally unavailable last album photograph')
                        return
                    owner.release.wait(60)
                # A small real-server delay also separates otherwise instantaneous cache events.
                if '/media/images/' in path:
                    time.sleep(0.015)
                try:
                    super().do_GET()
                except (BrokenPipeError, ConnectionResetError):
                    pass

        self.server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Handler, directory=str(ROOT / 'dist')))
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.base = f'http://127.0.0.1:{self.server.server_port}'

    def close(self):
        self.release.set()
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=2)


async def startup_ready(page):
    await page.wait_for_function("document.documentElement.dataset.siteLoadState === 'ready'", timeout=90000)
    await page.locator('#site-loader').wait_for(state='hidden')


async def check_whole_album(page, count):
    # No wait-for-each-image: the page must ALREADY be complete when the mask leaves.
    images = await page.locator('.album-masonry .piece img').evaluate_all('''images => images.map(img => ({
      src: img.currentSrc, complete: img.complete, width: img.naturalWidth,
      loading: img.loading, opacity: getComputedStyle(img).opacity,
      visible: getComputedStyle(img).visibility
    }))''')
    assert len(images) == count, (len(images), count)
    assert all(i['complete'] and i['width'] > 0 and i['loading'] == 'eager' and
               i['opacity'] == '1' and i['visible'] == 'visible' for i in images), images
    return {urlsplit(i['src']).path for i in images}


async def fast_scroll(page, count):
    for fraction in (0.25, 0.65, 1, 0.4, 1):
        await page.evaluate('''fraction => {
          const candidates = [document.scrollingElement, document.body, document.documentElement,
            ...document.querySelectorAll('#root, .react-page-wrapper, .page-wrapper')].filter(Boolean);
          for (const el of new Set(candidates)) {
            if (el.scrollHeight > el.clientHeight + 10) el.scrollTop = (el.scrollHeight-el.clientHeight)*fraction;
          }
        }''', fraction)
        await page.evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))')
        await check_whole_album(page, count)


async def run(browser, name, route, mobile, direct=False, failure=False):
    server = AlbumServer(route, failure)
    context = await browser.new_context(viewport={'width': 414 if mobile else 1440, 'height': 896 if mobile else 1000},
                                        is_mobile=mobile, has_touch=mobile, device_scale_factor=2 if mobile else 1)
    page = await context.new_page()
    page.set_default_timeout(45000)
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    case = f'{name}-{route}-' + ('direct' if direct else 'retry' if failure else 'navigation')
    result = {'name': case, 'passed': False, 'checks': [], 'photos': len(server.album['photos'])}
    try:
        await page.goto(server.base + (f'/{route}/' if direct else '/works/'), wait_until='domcontentloaded')
        if not direct:
            await startup_ready(page)
            await page.locator(f'.works-route a.listing-link[href$="/{route}"]').click()
        assert await asyncio.to_thread(server.requested.wait, 30), 'Last photograph was never scheduled'
        selector = '#site-loader' if direct else '#route-loader'
        overlay = page.locator(selector)
        await overlay.wait_for(state='visible')
        if failure:
            await overlay.get_by_role('button', name='Повторить загрузку').wait_for()
            assert int(await overlay.locator('[role=progressbar]').get_attribute('aria-valuenow')) < 100
            server.failure = False
            await overlay.get_by_role('button', name='Повторить загрузку').click()
            result['checks'].append('Failure in the last image keeps the mask and supports retry, not premature 100%')
        else:
            await page.wait_for_timeout(600)
            assert await overlay.is_visible(), 'First-six-photo readiness incorrectly opened the whole album'
            assert int(await overlay.locator('[role=progressbar]').get_attribute('aria-valuenow')) < 100
            if not direct:
                assert urlsplit(page.url).path.rstrip('/') == '/works', 'Incomplete album was committed'
            await page.screenshot(path=str(OUTPUT / f'{case}-waiting.png'), animations='disabled')
            result['checks'].append('A held final photograph (not the first six) keeps the fullscreen percentage loader')
        server.release.set()
        if direct:
            await startup_ready(page)
        else:
            await page.wait_for_url(re.compile(rf'/{route}/?$'))
            await page.locator('#route-loader').wait_for(state='hidden')
        image_paths = await check_whole_album(page, result['photos'])
        stamp = time.monotonic()
        await fast_scroll(page, result['photos'])
        assert not [p for t, p in server.requests if t > stamp and p in image_paths], 'Fast scrolling fetched missing page photographs'
        await page.screenshot(path=str(OUTPUT / f'{case}-ready-bottom.png'), animations='disabled')
        result['checks'].append('Every mounted photo is complete and visible at reveal; immediate end/middle scrolling fetches no page images')
        if not direct and not failure:
            await page.locator('.menu-list a', has_text='WORKS').click()
            await page.wait_for_url(re.compile(r'/works/?$'))
            await page.go_back()
            await page.wait_for_url(re.compile(rf'/{route}/?$'))
            await page.locator('#route-loader').wait_for(state='hidden')
            await check_whole_album(page, result['photos'])
            result['checks'].append('Back to a deep scroll position also restores a fully prepared album')
        assert not errors, errors
        result['passed'] = True
    except Exception as error:
        result['errors'] = errors + [str(error)]
        try:
            await page.screenshot(path=str(OUTPUT / f'{case}-failure.png'), animations='disabled', timeout=5000)
            result['tasks'] = await page.evaluate('window.__portfolioLoading?.tasks')
        except Exception:
            pass
    finally:
        server.release.set()
        await context.close()
        server.close()
    return result


async def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    results = []
    async with async_playwright() as tool:
        for engine, name, mobile in ((tool.chromium, 'chromium-desktop', False),
                                     (tool.chromium, 'chromium-mobile', True),
                                     (tool.webkit, 'webkit-mobile', True)):
            browser = await engine.launch()
            try:
                for route in ('portraits', 'projects', 'brands'):
                    result = await run(browser, name, route, mobile)
                    results.append(result)
                    print(json.dumps(result, ensure_ascii=False), flush=True)
                result = await run(browser, name, 'portraits', mobile, direct=True)
                results.append(result)
                print(json.dumps(result, ensure_ascii=False), flush=True)
                if name == 'chromium-desktop':
                    result = await run(browser, name, 'portraits', mobile, failure=True)
                    results.append(result)
                    print(json.dumps(result, ensure_ascii=False), flush=True)
            finally:
                await browser.close()
    (OUTPUT / 'report.json').write_text(json.dumps(results, indent=2, ensure_ascii=False))
    raise SystemExit(0 if all(result['passed'] for result in results) else 1)


if __name__ == '__main__':
    asyncio.run(main())
