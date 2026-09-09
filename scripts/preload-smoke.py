#!/usr/bin/env python3
"""Cold-cache startup/priority/recovery checks against a real HTTP server.
Responses use actual dist bytes and HTTP caching, not Playwright routing mocks.
"""
import argparse
import asyncio
from collections import Counter
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
OUTPUT = ROOT / 'test-results/browser/preloading'

class SiteServer:
    def __init__(self, failure=False):
        self.requests = []
        self.fail_photo = failure
        self.fail_project = False
        self.hold_home = not failure
        self.hold_projects = not failure
        self.home_requested = threading.Event()
        self.home_release = threading.Event()
        self.project_requested = threading.Event()
        self.project_release = threading.Event()
        owner = self
        class Handler(SimpleHTTPRequestHandler):
            def log_message(self, *args): pass
            def end_headers(self):
                if getattr(self, 'injected_failure', False):
                    self.send_header('Cache-Control', 'no-store')
                elif urlsplit(self.path).path.endswith(('.js','.css','.woff2','.ttf','.jpg','.png','.mp4')):
                    self.send_header('Cache-Control', 'public, max-age=86400')
                else:
                    self.send_header('Cache-Control', 'no-store')
                super().end_headers()
            def do_GET(self):
                path = urlsplit(self.path).path
                owner.requests.append((time.monotonic(), path))
                if '/home-photo-08-' in path:
                    owner.home_requested.set()
                    if owner.fail_photo:
                        self.injected_failure = True
                        self.send_error(503, 'Injected image failure'); return
                    if owner.hold_home: owner.home_release.wait(35)
                if '/projects-photo-001-' in path:
                    owner.project_requested.set()
                    if owner.fail_project:
                        self.injected_failure = True
                        self.send_error(503, 'Injected destination image failure'); return
                    if owner.hold_projects: owner.project_release.wait(45)
                try: super().do_GET()
                except (BrokenPipeError, ConnectionResetError): pass
        self.server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Handler, directory=str(ROOT/'dist')))
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.base = f'http://127.0.0.1:{self.server.server_port}'
    def close(self):
        self.home_release.set(); self.project_release.set()
        self.server.shutdown(); self.server.server_close(); self.thread.join(timeout=2)

async def ready(page, phase='ready'):
    await page.wait_for_function('(phase) => document.documentElement.dataset.siteLoadState === phase', arg=phase, timeout=90000)
    await page.locator('#site-loader').wait_for(state='hidden')

async def assert_neutral_loader(page, selector, screenshot):
    overlay = page.locator(selector)
    await overlay.wait_for(state='visible')
    await page.wait_for_function('(s) => getComputedStyle(document.querySelector(s)).opacity === "1"', arg=selector)
    text = (await overlay.locator('.site-loader-content').inner_text()).strip()
    assert re.fullmatch(r'\d{1,2}%', text), f'Expected only an incomplete numeric percentage, not a route name/count: {text!r}'
    progress = overlay.locator('[role=progressbar]')
    assert int(await progress.get_attribute('aria-valuenow')) == int(text[:-1])
    assert await overlay.locator('progress').count() == 0, 'Unexpected linear progress bar'
    geometry = await overlay.evaluate('''el => {
      const box = el.getBoundingClientRect();
      const spin = el.querySelector('.site-loader-spinner').getBoundingClientRect();
      const percent = el.querySelector('.loading-percent').getBoundingClientRect();
      const group = el.querySelector('.site-loader-content').getBoundingClientRect();
      return {x: box.x, y: box.y, w: box.width, h: box.height, vw: innerWidth, vh: innerHeight,
        spinX: spin.x + spin.width/2, spinBottom: spin.bottom, percentY: percent.y,
        groupY: group.y + group.height/2, background: getComputedStyle(el).backgroundColor,
        coversHeader: el.contains(document.elementFromPoint(10, 10))};
    }''')
    assert abs(geometry['x']) < 1 and abs(geometry['y']) < 1, geometry
    assert geometry['w'] >= geometry['vw']-20 and geometry['h'] >= geometry['vh']-1, geometry
    assert abs(geometry['spinX']-geometry['w']/2) < 2, geometry
    assert abs(geometry['groupY']-geometry['vh']/2) < 2, geometry
    assert geometry['percentY'] > geometry['spinBottom']+8, geometry
    assert geometry['background'] == 'rgb(30, 30, 30)' and geometry['coversHeader'], geometry
    await page.screenshot(path=str(OUTPUT/screenshot))

async def run_cold(browser, name, mobile, dpr):
    site = SiteServer()
    context = await browser.new_context(viewport={'width':414 if mobile else 1440,'height':896 if mobile else 1000},
        is_mobile=mobile, has_touch=mobile, device_scale_factor=dpr)
    page = await context.new_page(); page.set_default_timeout(30000)
    errors=[]; page.on('pageerror', lambda error: errors.append(str(error)))
    result={'name':name,'passed':False,'checks':[]}
    try:
        await page.goto(site.base+'/', wait_until='domcontentloaded')
        assert await asyncio.to_thread(site.home_requested.wait,20), 'Held home photograph was never requested'
        await page.wait_for_timeout(5000)
        assert await page.locator('#site-loader').is_visible(), 'Spinner dismissed before complete home download'
        assert await page.evaluate('window.__portfolioLoading.phase') == 'loading'
        assert not any('/media/images/'+part+'/' in p for _,p in site.requests for part in ('portraits','projects','brands')), 'Background galleries competed with startup'
        assert await page.locator('.native-home-slider .slide').first.evaluate('(el) => Number(el.style.opacity)') == 1, 'Slider advanced behind startup overlay'
        await assert_neutral_loader(page, '#site-loader', f'{name}-startup-spinner.png')
        result['checks'].append('Held home photo keeps neutral fullscreen spinner with a real percentage; no route label or count; hero and background wait')
        site.home_release.set(); await ready(page)
        images = await page.locator('#root img').evaluate_all('(imgs) => imgs.map(i => ({src:i.currentSrc,complete:i.complete,width:i.naturalWidth}))')
        assert images and all(i['complete'] and i['width']>0 for i in images), images
        assert await page.locator('#home-main .picture-section').count() == 8
        await page.screenshot(path=str(OUTPUT/f'{name}-ready-home.png'))
        initial_tasks=await page.evaluate('window.__portfolioLoading.tasks')
        core_paths={urlsplit(t['id'].split(':',1)[1]).path for t in initial_tasks if t['id'].startswith('image:') and t['priority']==0}
        await page.evaluate('''() => {
          window.__qaOverlayMounts = 0;
          window.__qaOverlayObserver = new MutationObserver(records => {
            for (const record of records) for (const node of record.addedNodes) {
              if (node instanceof Element && (node.id === 'route-loader' || node.querySelector('#route-loader'))) window.__qaOverlayMounts++;
            }
          });
          window.__qaOverlayObserver.observe(document.body, {childList:true, subtree:true});
        }''')
        stamp=time.monotonic()
        await page.locator('#home-main .picture-section').last.scroll_into_view_if_needed()
        await page.locator('.menu-list a',has_text='WORKS').click()
        await page.locator('.works-route').wait_for()
        await page.locator('.menu-list a',has_text='CONTACTS').click()
        await page.wait_for_function("document.querySelector('.menu-list [aria-current=page]')?.textContent === 'CONTACTS'")
        await page.locator('.menu-list a',has_text='HOME').click()
        await page.locator('#home-main').wait_for()
        await page.wait_for_timeout(200)
        primary = [p for t,p in site.requests if t>stamp and p in core_paths]
        assert not primary, f'Primary pages requested new image bytes after startup: {primary}'
        assert await page.evaluate('window.__qaOverlayMounts') == 0, 'Prepared main routes flashed a loading screen'
        await page.evaluate('window.__qaOverlayObserver.disconnect()')
        result['checks'].append('Entire home is loaded; immediate Home/Works/Contacts navigation reuses cache with no spinner flash')
        await page.locator('.menu-list a',has_text='WORKS').click(); await page.locator('.works-route').wait_for()
        assert await asyncio.to_thread(site.project_requested.wait,25), 'Background never reached Projects before click'
        await page.locator('.works-route a.listing-link[href$="/projects"]').click()
        await page.locator('#route-loader').wait_for(state='visible')
        assert urlsplit(page.url).path.rstrip('/') == '/works', 'An incomplete destination replaced the painted page'
        await assert_neutral_loader(page, '#route-loader', f'{name}-navigation-spinner.png')
        assert await page.locator('#root').evaluate('(el) => el.inert'), 'Underlying menu remains interactive'
        await page.keyboard.press('Tab')
        assert await page.locator('#route-loader').evaluate('(el) => el.contains(document.activeElement)'), 'Focus escaped the overlay'
        # The menu is deliberately covered now. A real browser Back action must
        # still cancel a pending destination instead of allowing stale navigation.
        await page.go_back()
        await page.locator('#home-main').wait_for()
        await page.locator('#route-loader').wait_for(state='hidden')
        assert not await page.locator('#root').evaluate('(el) => el.inert'), 'Overlay left the page inert'
        await page.locator('.menu-list a',has_text='CONTACTS').click()
        await page.wait_for_function("document.querySelector('.menu-list [aria-current=page]')?.textContent === 'CONTACTS'")
        site.project_release.set(); await page.wait_for_timeout(300)
        assert urlsplit(page.url).path.rstrip('/') == '/contacts', 'Superseded Projects loader performed stale navigation'
        result['checks'].append('Slow destination shows centered fullscreen percent overlay, traps focus; Back cancels it without stale navigation or stuck locks')
        await page.wait_for_function("window.__portfolioLoading.tasks.filter(t => t.priority <= 30).every(t => t.state === 'ready')", timeout=90000)
        tasks=await page.evaluate('window.__portfolioLoading.tasks')
        previews=[t for t in tasks if t['id'].startswith('image:') and t['priority']<=30]
        assert len(previews)>=90, f'Gallery warmup is still a partial sample: {len(previews)}'
        assert not any('/archive/' in t['id'] for t in tasks)
        assert any(t['id'].startswith('video:') for t in tasks), 'Video queue not registered'
        result['checks'].append('All page-size album images finish without visiting albums; zoom/videos remain queued later; archives excluded')
        result['tasks']=len(tasks)
        result['primary_requests']=dict(Counter(p for _,p in site.requests if '/media/images/home/' in p))
        assert all(count==1 for count in result['primary_requests'].values()), result['primary_requests']
        assert not errors, errors
        result['passed']=True
    except Exception as error:
        result['errors']=errors+[str(error)]
        try: await page.screenshot(path=str(OUTPUT/f'{name}-failure.png'))
        except Exception: pass
    finally:
        site.home_release.set(); site.project_release.set()
        await context.close(); site.close()
    return result

async def run_recovery(browser, bypass=False):
    site=SiteServer(failure=True)
    context=await browser.new_context(viewport={'width':414,'height':896},is_mobile=True,has_touch=True)
    page=await context.new_page(); page.set_default_timeout(30000)
    result={'name':'explicit-opt-out' if bypass else 'failed-image-retry','passed':False}
    try:
        await page.goto(site.base+'/',wait_until='domcontentloaded')
        await page.locator('#site-loader-retry').wait_for(state='visible')
        assert await page.locator('#site-loader').is_visible()
        assert await page.evaluate('window.__portfolioLoading.phase')=='loading'
        assert int(await page.locator('#site-loader-progress').get_attribute('aria-valuenow')) < 100
        if bypass:
            await page.locator('#site-loader-continue').click(); await ready(page,'degraded')
            tasks=await page.evaluate('window.__portfolioLoading.tasks')
            assert any(t['state']=='error' for t in tasks), 'Opt-out falsely converted failures into ready assets'
        else:
            site.fail_photo=False
            await page.locator('#site-loader-retry').click(); await ready(page)
            assert await page.locator('#home-main .picture-section img').last.evaluate('(i) => i.complete && i.naturalWidth > 0')
        result['passed']=True
    except Exception as error:
        result['error']=str(error)
        try: await page.screenshot(path=str(OUTPUT/f'{result["name"]}-failure.png'))
        except Exception: pass
    finally:
        await context.close(); site.close()
    return result

async def run_destination_recovery(browser, bypass=False):
    site = SiteServer()
    site.hold_home = site.hold_projects = False
    site.fail_project = True
    context = await browser.new_context(viewport={'width':360,'height':800}, is_mobile=True, has_touch=True, reduced_motion='reduce')
    page = await context.new_page(); page.set_default_timeout(30000)
    result = {'name':'route-explicit-opt-out' if bypass else 'route-error-retry-reduced-motion', 'passed':False}
    try:
        await page.goto(site.base+'/works/', wait_until='domcontentloaded'); await ready(page)
        await page.locator('.works-route a.listing-link[href$="/projects"]').click()
        overlay = page.locator('#route-loader')
        await overlay.get_by_role('button', name='Повторить загрузку').wait_for()
        assert int(await overlay.locator('[role=progressbar]').get_attribute('aria-valuenow')) < 100
        assert await overlay.locator('.site-loader-spinner').evaluate('(el) => getComputedStyle(el).animationName') == 'none'
        assert await page.locator('#root').evaluate('(el) => el.inert')
        if bypass:
            await overlay.get_by_role('button', name='Открыть доступную часть', exact=True).click()
        else:
            site.fail_project = False
            await overlay.get_by_role('button', name='Повторить загрузку').click()
        await page.wait_for_url(re.compile(r'/projects/?$'))
        await overlay.wait_for(state='hidden')
        assert not await page.locator('#root').evaluate('(el) => el.inert')
        assert await page.evaluate('document.documentElement.hasAttribute("data-navigation-loading")') is False
        result['passed'] = True
    except Exception as error:
        result['error'] = str(error)
        try: await page.screenshot(path=str(OUTPUT/f'{result["name"]}-failure.png'))
        except Exception: pass
    finally:
        await context.close(); site.close()
    return result

async def main():
    parser=argparse.ArgumentParser(); parser.add_argument('--base'); parser.parse_args()
    OUTPUT.mkdir(parents=True,exist_ok=True); results=[]
    async with async_playwright() as p:
        for engine,name,mobile,dpr in [(p.chromium,'chromium-desktop',False,1),(p.chromium,'chromium-mobile-retina',True,2),(p.webkit,'webkit-mobile-retina',True,2)]:
            browser=await engine.launch()
            try:
                result=await run_cold(browser,name,mobile,dpr); results.append(result); print(json.dumps(result,ensure_ascii=False),flush=True)
                if name=='chromium-desktop':
                    for check in (run_recovery, run_destination_recovery):
                        for bypass in (False,True):
                            result=await check(browser,bypass); results.append(result); print(json.dumps(result,ensure_ascii=False),flush=True)
            finally: await browser.close()
    (OUTPUT/'report.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
    raise SystemExit(0 if all(item['passed'] for item in results) else 1)
if __name__=='__main__': asyncio.run(main())
