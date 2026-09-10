#!/usr/bin/env python3
"""First-screen gate and one-screen-ahead lazy images, using real HTTP/browser cache."""
import argparse
import asyncio
from functools import partial
from http.server import ThreadingHTTPServer
import json
from pathlib import Path
import re
import threading
import time
from urllib.parse import urlsplit
from playwright.async_api import async_playwright
from media_http import MediaRangeHandler

ROOT = Path(__file__).resolve().parent.parent

def content(name):
    text = (ROOT / f'src/content/pages/{name}.ts').read_text()
    return json.JSONDecoder().raw_decode(text.split('= ', 1)[1].lstrip())[0]

SCROLLER = """() => [...document.querySelectorAll('*')].find(el =>
 el.clientWidth > innerWidth*.7 && el.clientHeight > innerHeight*.5 &&
 el.scrollHeight > el.clientHeight+200 && /auto|scroll/.test(getComputedStyle(el).overflowY)
) || document.scrollingElement"""
VISIBLE = """() => [...document.querySelectorAll('.react-route img')].filter(i => {
 if(i.closest('[aria-hidden="true"]')) return false;
 const r=i.getBoundingClientRect();return r.width>0 && r.height>0 && r.bottom>0 && r.top<innerHeight;
}).every(i=>i.complete && i.naturalWidth>0 && getComputedStyle(i).opacity==='1')"""

class Server:
    def __init__(self, hold_hero=False, fail_hero=False):
        self.requests = []
        self.hold_hero = hold_hero
        self.fail_hero = fail_hero
        self.release = threading.Event()
        self.hero_requested = threading.Event()
        hero = content('home')['cover']['slides'][0]['src']
        self.hero = re.sub(r'-\d+x\d+(?=\.)', '', Path(hero).name)
        owner = self
        class Handler(MediaRangeHandler):
            def log_message(self, *_args): pass
            def end_headers(self):
                self.send_header('Cache-Control', 'no-store' if getattr(self, 'failed', False) else 'public, max-age=86400')
                super().end_headers()
            def do_GET(self):
                path = urlsplit(self.path).path
                owner.requests.append((time.monotonic(), path))
                if re.sub(r'-\d+x\d+(?=\.)', '', Path(path).name) == owner.hero:
                    owner.hero_requested.set()
                    if owner.fail_hero:
                        self.failed = True
                        self.send_error(503, 'Intentional critical-image failure')
                        return
                    if owner.hold_hero: owner.release.wait(30)
                if '/media/images/' in path: time.sleep(.04)
                try: super().do_GET()
                except (BrokenPipeError, ConnectionResetError): pass
        self.server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Handler, directory=str(ROOT/'dist')))
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.base = f'http://127.0.0.1:{self.server.server_port}'
    def close(self):
        self.release.set(); self.server.shutdown(); self.server.server_close(); self.thread.join(timeout=2)

async def ready(page):
    await page.wait_for_function("document.documentElement.dataset.siteLoadState === 'ready'", timeout=90000)
    await page.locator('#site-loader').wait_for(state='hidden')
    await page.wait_for_function(VISIBLE)

async def exercise(browser, name, mobile, output, base=None):
    server = None if base else Server(hold_hero=True)
    base = base or server.base
    context = await browser.new_context(viewport={'width':414 if mobile else 1440,'height':896 if mobile else 1000},
        is_mobile=mobile, has_touch=mobile, device_scale_factor=2 if mobile else 1)
    await context.add_init_script('''
      window.__qaOverlayMounts=0;
      new MutationObserver(rs=>{ for(const r of rs) for(const n of r.addedNodes)
        if(n instanceof Element && (n.id==='route-loader'||n.querySelector('#route-loader'))) window.__qaOverlayMounts++;
      }).observe(document,{childList:true,subtree:true});
    ''')
    page = await context.new_page()
    page.set_default_timeout(30000)
    page.set_default_navigation_timeout(60000)
    errors, requests = [], []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('response', lambda r: errors.append(f'{r.status} {r.url}') if r.status >= 400 and r.request.resource_type in ('image','script','stylesheet','font') else None)
    page.on('request', lambda r: requests.append((time.monotonic(), r.resource_type, r.url)))
    result = {'name':name, 'base':base, 'passed':False, 'checks':[]}
    try:
        before = time.monotonic()
        await page.goto(base+'/', wait_until='commit')
        if server:
            assert await asyncio.to_thread(server.hero_requested.wait, 15), 'Critical hero was never requested'
            await page.wait_for_timeout(2000)
            assert await page.locator('#site-loader').is_visible(), 'Critical hero did not hold initial loader'
            assert await page.locator('.native-home-slider img').count() == 1, 'All slides were mounted behind startup'
            server.release.set()
            result['checks'].append('Held first hero keeps startup visible; other slider frames do not load behind it')
        await ready(page)
        result['ready_seconds_in_test'] = round(time.monotonic()-before, 3)
        snapshot = await page.evaluate('window.__portfolioLoading')
        assert snapshot['policy'] == 'first-screens-lazy'
        ids = snapshot['startupIds']
        images = [i[6:] for i in ids if i.startswith('image:')]
        assert len(images) == 6, f'Home startup image inventory expanded: {images}'
        assert not any(i.startswith('video:') for i in ids)
        assert not [url for _, kind, url in requests if kind == 'media'], 'Home requested videos before entry'
        result['startup_tasks'] = len(ids)
        if server:
            result['critical_image_file_bytes'] = sum((ROOT/'dist'/urlsplit(path).path.lstrip('/')).stat().st_size for path in set(images))
            assert result['critical_image_file_bytes'] < 12_000_000, 'First-screen image budget exceeded'
        await page.screenshot(path=str(output/f'{name}-home-ready.png'), animations='disabled')
        await page.wait_for_timeout(2500)
        portrait_tail = re.search(r'(portraits-photo-\d+)', content('portraits')['photos'][-1]['image']['src'])[1]
        assert not any(portrait_tail in url for _,_,url in requests), 'Offscreen album tail was speculatively downloaded'
        assert not any('/media/video/' in url for _,_,url in requests), 'Home background preloaded whole videos'
        result['remaining_native_lazy_home_images'] = await page.locator('#home-main .picture-section img[loading=lazy]').count()
        result['checks'].append('Six core images only; no full-site, zoom or video gate, no background album tails')

        for route in ('portraits','projects','brands'):
            if urlsplit(page.url).path.rstrip('/') != '/works':
                await page.locator('.menu-list a', has_text='WORKS').click()
            await page.locator('.works-route').wait_for()
            await page.locator(f'.works-route a.listing-link[href$="/{route}"]').click()
            await page.wait_for_url(re.compile(rf'/{route}/?$'))
            await page.locator('.album-masonry').wait_for()
            await page.wait_for_function(VISIBLE)
            count = len(content(route)['photos'])
            assert await page.locator('.album-masonry .piece img').count() == count
            if route == 'portraits':
                assert await page.locator('.album-masonry .piece img').last.get_attribute('loading') == 'lazy'
                assert not any(portrait_tail in url for _,_,url in requests), 'Last Portraits photo requested before approaching it'
            scroller = await page.evaluate_handle(SCROLLER)
            result.setdefault('scroll_roots', []).append(await scroller.evaluate('(e)=>({tag:e.tagName,id:e.id,height:e.clientHeight,scrollHeight:e.scrollHeight,scrollTop:e.scrollTop,overflow:getComputedStyle(e).overflowY})'))
            # Position the observer sample from real photograph geometry. Fixed
            # scroll deltas can overshoot all photos in a short album, especially
            # after Back restores a scrolled category card on the mobile BODY.
            await scroller.evaluate('(el)=>{el.scrollTop=0}')
            await page.wait_for_timeout(200)
            target = await page.locator('.album-masonry .piece img').evaluate_all('''imgs => {
              const items=imgs.map((i,index)=>({index,y:i.getBoundingClientRect().top}));
              return items.find(i=>i.y>innerHeight*2.1) || items.find(i=>i.y>innerHeight+30);
            }''')
            assert target, f'No photo below the first screen: {route}'
            await scroller.evaluate('(el,y)=>{el.scrollTop=Math.max(0,y-el.clientHeight*1.25)}', target['y'])
            await page.wait_for_timeout(350)
            sample = await page.locator('.album-masonry .piece img').nth(target['index']).evaluate('''i=>({
              y:i.getBoundingClientRect().top, loading:i.loading,
              ahead:i.closest('[data-role="lazy-image"]').dataset.ahead, height:innerHeight
            })''')
            assert sample['height']+10 < sample['y'] < sample['height']*1.9, sample
            assert sample['loading']=='eager' and sample['ahead']=='ready', sample
            result.setdefault('offscreen_promotion_samples',[]).append({'route':route,**sample})
            await page.wait_for_function(VISIBLE)
            for _ in range(6):
                await scroller.evaluate('(el)=>{el.scrollTop += el.clientHeight*.3}')
                await page.wait_for_timeout(250)
                await page.wait_for_function(VISIBLE)
            last = page.locator('.album-masonry .piece img').last
            await last.scroll_into_view_if_needed()
            await page.wait_for_function(VISIBLE)
            await last.evaluate('(i)=>i.decode()')
            assert await last.evaluate('(i)=>i.naturalWidth>0 && i.loading==="eager"')
            await page.screenshot(path=str(output/f'{name}-{route}-last.png'), animations='disabled')
            await page.locator('a.js-gallery-link').last.click()
            await page.wait_for_function('window.pswp?.opener?.isOpen === true')
            await page.wait_for_function('window.pswp?.currSlide?.content?.element?.naturalWidth > 0')
            assert await page.evaluate('window.pswp.currIndex') == count-1
            await page.locator('.pswp__button--close').click()
            await page.locator('.pswp').wait_for(state='detached')
            await page.go_back(); await page.locator('.works-route').wait_for()
            result['checks'].append(f'{route}: ahead-of-viewport eager promotion, actual scroll, tail, viewer, Back')
        await page.locator('.menu-list a',has_text='CONTACTS').click()
        await page.wait_for_function(VISIBLE)
        await page.locator('.menu-list a',has_text='HOME').click()
        await page.locator('#home-main').wait_for()
        await page.set_viewport_size({'width':740 if mobile else 1100,'height':500 if mobile else 900})
        await page.wait_for_timeout(400)
        await page.wait_for_function(VISIBLE)
        assert await page.evaluate('window.__qaOverlayMounts') == 0
        assert not errors, errors
        result['checks'].append('No route-loading overlays; responsive resize preserves visible media')
        result['passed'] = True
    except Exception as error:
        result['errors'] = errors + [str(error)]
        try:
            result['state'] = await page.evaluate('''() => {
              const image=[...document.querySelectorAll('.album-masonry img')].find(i=>i.getBoundingClientRect().top>innerHeight);
              const parents=[]; for(let e=image?.parentElement;e;e=e.parentElement){
                const r=e.getBoundingClientRect();parents.push({tag:e.tagName,cls:e.className,top:r.top,height:r.height,client:e.clientHeight,scroll:e.scrollHeight,overflow:getComputedStyle(e).overflowY});
              }
              return {path:location.pathname,parents,loading:window.__portfolioLoading};
            }''')
            await page.screenshot(path=str(output/f'{name}-failure.png'), animations='disabled', timeout=5000)
        except Exception: pass
    finally:
        if server: server.release.set()
        await context.close()
        if server: server.close()
    return result

async def recovery(browser, output):
    server = Server(fail_hero=True)
    context = await browser.new_context(viewport={'width':414,'height':896})
    page = await context.new_page()
    result = {'name':'critical-image-retry','passed':False}
    try:
        await page.goto(server.base+'/', wait_until='commit')
        await page.locator('#site-loader-retry').wait_for(state='visible', timeout=30000)
        assert await page.locator('#site-loader').is_visible()
        server.fail_hero = False
        await page.locator('#site-loader-retry').click()
        await ready(page)
        result['passed'] = True
    except Exception as error: result['error'] = str(error)
    finally:
        await context.close(); server.close()
    return result

async def timing(browser, base, output):
    server=None if base else Server()
    context=await browser.new_context(viewport={'width':1440,'height':1000})
    page=await context.new_page(); page.set_default_timeout(30000)
    cdp=await context.new_cdp_session(page)
    await cdp.send('Network.enable')
    await cdp.send('Network.emulateNetworkConditions',{'offline':False,'latency':80,'downloadThroughput':2500000,'uploadThroughput':1250000})
    result={'name':'cold-entry-20mbps','passed':False,'download_mbps':20,'latency_ms':80}
    try:
        start=time.monotonic()
        await page.goto((base or server.base)+'/',wait_until='commit')
        await ready(page)
        result['ready_seconds']=round(time.monotonic()-start,3)
        result['resource_transfer_bytes_at_ready']=await page.evaluate('performance.getEntriesByType("resource").reduce((n,e)=>n+e.transferSize,0)')
        await page.screenshot(path=str(output/'cold-entry-20mbps.png'),animations='disabled')
        result['passed']=True
    except Exception as error: result['error']=str(error)
    finally:
        await context.close()
        if server: server.close()
    return result

async def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--base')
    parser.add_argument('--output',default='test-results/browser/lazy-loading')
    args=parser.parse_args(); output=Path(args.output); output.mkdir(parents=True,exist_ok=True)
    results=[]
    async with async_playwright() as p:
        for engine,name,mobile in ((p.chromium,'chromium-desktop',False),(p.chromium,'chromium-mobile',True),(p.webkit,'webkit-mobile',True)):
            browser=await engine.launch()
            try:
                result=await exercise(browser,name,mobile,output,args.base.rstrip('/') if args.base else None)
                results.append(result); print(json.dumps(result,ensure_ascii=False),flush=True)
                if name=='chromium-desktop':
                    if not args.base:
                        result=await recovery(browser,output); results.append(result); print(json.dumps(result),flush=True)
                    result=await timing(browser,args.base,output); results.append(result); print(json.dumps(result),flush=True)
            finally: await browser.close()
    (output/'report.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
    raise SystemExit(0 if all(r['passed'] for r in results) else 1)
if __name__=='__main__': asyncio.run(main())
