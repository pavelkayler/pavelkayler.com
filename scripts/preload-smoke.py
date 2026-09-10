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
                        self.send_error(503, 'Injected gallery failure'); return
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

async def overlay_check(page, selector, recovery=False):
    overlay = page.locator(selector)
    await overlay.wait_for(state='visible')
    text = (await overlay.inner_text()).strip()
    assert 'Подготовка' not in text and not re.search(r'\d+\s+из\s+\d+', text), text
    percent_text = (await overlay.locator('.site-loader-percentage').inner_text()).strip()
    assert re.fullmatch(r'\d{1,3}%', percent_text), percent_text
    percent = int(percent_text[:-1])
    assert 0 <= percent < 100, f'Unfinished loading reported {percent}%'
    assert int(await overlay.locator('[role=progressbar]').get_attribute('aria-valuenow')) == percent
    if not recovery: assert text == percent_text, f'Unexpected ordinary loading text: {text}'
    geometry = await overlay.evaluate('''el => {
      const r=el.getBoundingClientRect(), s=getComputedStyle(el);
      const a=el.querySelector('.site-loader-spinner').getBoundingClientRect();
      const b=el.querySelector('.site-loader-percentage').getBoundingClientRect();
      return {left:r.left,top:r.top,width:r.width,height:r.height,vw:innerWidth,vh:innerHeight,
        fixed:s.position,background:s.backgroundColor,opacity:s.opacity,
        centered:Math.abs(a.left+a.width/2-r.left-r.width/2)<2,
        below:b.top>a.bottom,portal:el.parentElement===document.body,
        covers:el.contains(document.elementFromPoint(innerWidth/2,20))};
    }''')
    assert geometry['fixed']=='fixed' and geometry['left']==0 and geometry['top']==0, geometry
    assert geometry['width'] >= geometry['vw']-20 and geometry['height'] >= geometry['vh']-1, geometry
    assert geometry['background']=='rgb(30, 30, 30)' and geometry['opacity']=='1', geometry
    assert all(geometry[k] for k in ('centered','below','portal','covers')), geometry
    assert await overlay.get_attribute('role')=='dialog'
    assert await overlay.get_attribute('aria-modal')=='true'
    assert await page.locator('#root').evaluate('(el) => el.inert')
    await page.keyboard.press('Tab')
    assert await overlay.evaluate('(el) => el.contains(document.activeElement)'), 'Focus escaped loading overlay'
    return {'percent':percent,'geometry':geometry}

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
        result['startup_overlay'] = await overlay_check(page,'#site-loader')
        await page.screenshot(path=str(OUTPUT/f'{name}-startup-spinner.png'))
        result['checks'].append('Held home photo >4.5s keeps the anonymous percentage spinner and first hero frame; no album competition')
        site.home_release.set(); await ready(page)
        images = await page.locator('#root img').evaluate_all('(imgs) => imgs.map(i => ({src:i.currentSrc,complete:i.complete,width:i.naturalWidth}))')
        assert images and all(i['complete'] and i['width']>0 for i in images), images
        assert await page.locator('#home-main .picture-section').count() == 8
        await page.screenshot(path=str(OUTPUT/f'{name}-ready-home.png'))
        initial_tasks=await page.evaluate('window.__portfolioLoading.tasks')
        core_paths={urlsplit(t['id'].split(':',1)[1]).path for t in initial_tasks if t['id'].startswith('image:') and t['priority']==0}
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
        result['checks'].append('Entire home is loaded; immediate Home/Works/Contacts navigation reuses the HTTP cache')
        await page.locator('.menu-list a',has_text='WORKS').click(); await page.locator('.works-route').wait_for()
        assert await asyncio.to_thread(site.project_requested.wait,25), 'Background never reached Projects before click'
        await page.locator('.works-route a.listing-link[href$="/projects"]').click()
        await page.wait_for_timeout(350)
        assert urlsplit(page.url).path.rstrip('/') == '/works', 'An incomplete destination committed before loading'
        result['route_overlay'] = await overlay_check(page,'#route-loader')
        assert await page.locator('.route-loading-status').count()==0, 'The old bottom preparation toast remains'
        await page.screenshot(path=str(OUTPUT/f'{name}-route-spinner.png'))
        # A fullscreen modal intentionally blocks the old menu. Escape cancels the
        # pending destination, then the user may choose another menu item normally.
        await page.keyboard.press('Escape')
        await page.locator('#route-loader').wait_for(state='hidden')
        await page.wait_for_function("!document.getElementById('root').inert")
        assert urlsplit(page.url).path.rstrip('/')=='/works'
        await page.locator('.menu-list a',has_text='CONTACTS').click()
        await page.wait_for_function("document.querySelector('.menu-list [aria-current=page]')?.textContent === 'CONTACTS'")
        site.project_release.set(); await page.wait_for_timeout(350)
        assert urlsplit(page.url).path.rstrip('/') == '/contacts', 'Superseded Projects loader performed stale navigation'
        result['checks'].append('Early gallery entry shows an opaque viewport-centered percentage modal; Escape cancels without stale navigation')
        await page.wait_for_function("window.__portfolioLoading.tasks.filter(t => t.priority <= 30).every(t => t.state === 'ready')", timeout=90000)
        tasks=await page.evaluate('window.__portfolioLoading.tasks')
        previews=[t for t in tasks if t['id'].startswith('image:') and t['priority']<=30]
        assert len(previews)>=90, f'Gallery warmup is still a partial sample: {len(previews)}'
        assert not any('/archive/' in t['id'] for t in tasks)
        assert any(t['id'].startswith('video:') for t in tasks), 'Video queue not registered'
        result['checks'].append('All page-size album images queued and completed without visiting albums; zoom/videos queued afterwards; archives excluded')
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
        await overlay_check(page,'#site-loader',recovery=True)
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

async def run_route_recovery(browser, bypass=False):
    site=SiteServer()
    site.hold_home=site.hold_projects=False
    site.fail_project=True
    context=await browser.new_context(viewport={'width':414,'height':896},is_mobile=True,has_touch=True,
        reduced_motion='reduce')
    page=await context.new_page(); page.set_default_timeout(30000)
    result={'name':'route-opt-out' if bypass else 'route-failure-retry','passed':False}
    try:
        await page.goto(site.base+'/',wait_until='domcontentloaded'); await ready(page)
        await page.locator('.menu-list a',has_text='WORKS').click(); await page.locator('.works-route').wait_for()
        await page.locator('.works-route a.listing-link[href$="/projects"]').click()
        await page.locator('#route-loader button',has_text='Повторить загрузку').wait_for(state='visible')
        await overlay_check(page,'#route-loader',recovery=True)
        assert await page.locator('#route-loader .site-loader-spinner').evaluate('(el)=>getComputedStyle(el).animationName')=='none'
        await page.evaluate('''() => {
          window.__loadingPercentSamples=[];
          const record=()=>{const e=document.querySelector('#route-loader [role=progressbar]');
            if(e) window.__loadingPercentSamples.push(Number(e.getAttribute('aria-valuenow')));};
          new MutationObserver(record).observe(document.body,{subtree:true,attributes:true,childList:true}); record();
        }''')
        if bypass:
            await page.locator('#route-loader button',has_text='Открыть доступную часть').click()
        else:
            site.fail_project=False
            await page.locator('#route-loader button',has_text='Повторить загрузку').click()
        await page.wait_for_function("location.pathname.replace(/\/$/,'')==='/projects'")
        await page.locator('#route-loader').wait_for(state='hidden')
        await page.wait_for_function("!document.getElementById('root').inert && !document.documentElement.hasAttribute('data-overlay-loading')")
        samples=await page.evaluate('window.__loadingPercentSamples')
        if bypass:
            assert 100 not in samples, f'Partial entry pretended to finish: {samples}'
            assert await page.evaluate("window.__portfolioLoading.tasks.some(t=>t.state==='error')")
        else:
            assert 100 in samples, f'Ready destination never completed percentage: {samples}'
        await page.locator('.menu-list a',has_text='CONTACTS').click()
        await page.wait_for_function("document.querySelector('.menu-list [aria-current=page]')?.textContent==='CONTACTS'")
        result['samples']=samples; result['passed']=True
    except Exception as error:
        result['error']=str(error)
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
                    for check in (run_recovery,run_route_recovery):
                        for bypass in (False,True):
                            result=await check(browser,bypass); results.append(result); print(json.dumps(result,ensure_ascii=False),flush=True)
            finally: await browser.close()
    (OUTPUT/'report.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
    raise SystemExit(0 if all(item['passed'] for item in results) else 1)
if __name__=='__main__': asyncio.run(main())
