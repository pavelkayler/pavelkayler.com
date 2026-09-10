#!/usr/bin/env python3
"""One startup gate, then all pages with an unavailable origin and real browser cache."""
import asyncio
from functools import partial
from http.server import ThreadingHTTPServer
import importlib.util
import json
from pathlib import Path
import re
import threading
import time
from urllib.parse import urlsplit
from playwright.async_api import async_playwright
from media_http import MediaRangeHandler
ROOT=Path(__file__).resolve().parent.parent
OUTPUT=ROOT/'test-results/browser/single-startup'
spec=importlib.util.spec_from_file_location('album_checks',ROOT/'scripts/album-readiness-smoke.py')
checks=importlib.util.module_from_spec(spec);spec.loader.exec_module(checks)
ALBUMS={route:checks.album_data(route) for route in ('portraits','projects','brands')}
class Server:
    def __init__(self,failure=False):
        self.requests=[];self.failure=failure;self.unavailable=False
        self.requested=threading.Event();self.release=threading.Event()
        self.tail=re.search(r'/([^/]+-photo-\d+)-',ALBUMS['portraits']['photos'][-1]['image']['src'])[1]
        owner=self
        class Handler(MediaRangeHandler):
            def log_message(self,*args):pass
            def end_headers(self):
                self.send_header('Cache-Control','no-store' if getattr(self,'failed',False) else 'public, max-age=86400')
                super().end_headers()
            def do_GET(self):
                path=urlsplit(self.path).path;owner.requests.append((time.monotonic(),path))
                if owner.unavailable:
                    self.failed=True;self.send_error(503,'Origin unavailable after startup');return
                if owner.tail+'-' in path:
                    owner.requested.set()
                    if owner.failure:
                        self.failed=True;self.send_error(503,'Deliberate last photo failure');return
                    if not owner.release.wait(120):
                        self.failed=True;self.send_error(504,'Test release missing');return
                try:super().do_GET()
                except (BrokenPipeError,ConnectionResetError):pass
        self.server=ThreadingHTTPServer(('127.0.0.1',0),partial(Handler,directory=str(ROOT/'dist')))
        self.thread=threading.Thread(target=self.server.serve_forever,daemon=True);self.thread.start()
        self.base=f'http://127.0.0.1:{self.server.server_port}'
    def close(self):
        self.release.set();self.server.shutdown();self.server.server_close();self.thread.join(timeout=2)
async def ready(page):
    await page.wait_for_function("document.documentElement.dataset.siteLoadState === 'ready'",timeout=180000)
    await page.locator('#site-loader').wait_for(state='hidden')
async def viewer_ready(page):
    await page.wait_for_function('window.pswp?.opener?.isOpen === true')
    await page.wait_for_function('window.pswp?.currSlide?.content?.element?.complete && window.pswp.currSlide.content.element.naturalWidth > 0')
async def cold(browser,name,mobile,entry):
    server=Server()
    context=await browser.new_context(viewport={'width':414 if mobile else 1440,'height':896 if mobile else 1000},is_mobile=mobile,has_touch=mobile,device_scale_factor=2 if mobile else 1)
    await context.add_init_script('''
      window.__qaOverlays=0;window.__qaNativeTransitions=0;
      new MutationObserver(records=>{for(const r of records) for(const n of r.addedNodes)
        if(n instanceof Element&&(n.id==='route-loader'||n.querySelector('#route-loader')))window.__qaOverlays++;
      }).observe(document,{childList:true,subtree:true});
      if(document.startViewTransition){const original=document.startViewTransition.bind(document);
        document.startViewTransition=(...args)=>{window.__qaNativeTransitions++;return original(...args)};}
    ''')
    page=await context.new_page();page.set_default_timeout(30000)
    errors=[];failed=[];stage='startup'
    page.on('pageerror',lambda error:errors.append(str(error)))
    page.on('requestfailed',lambda r:failed.append({'url':r.url,'type':r.resource_type,'reason':r.failure}))
    result={'name':name,'entry':entry,'passed':False,'checks':[]}
    try:
        await page.goto(server.base+entry,wait_until='domcontentloaded')
        assert await asyncio.to_thread(server.requested.wait,45),'Last Portraits image not scheduled'
        await page.wait_for_timeout(5000)
        assert await page.locator('#site-loader').is_visible(),'Incomplete site revealed'
        assert await page.evaluate('window.__portfolioLoading.phase')=='loading'
        text=(await page.locator('#site-loader .site-loader-content').inner_text()).strip()
        assert re.fullmatch(r'\d{1,2}%',text),text
        await page.screenshot(path=str(OUTPUT/f'{name}-startup.png'),animations='disabled')
        result['checks'].append('A held final album photo blocks the only startup gate, including on Home/Contacts entry')
        server.release.set();await ready(page)
        tasks=await page.evaluate('window.__portfolioLoading.tasks')
        assert tasks and all(t['state']=='ready' for t in tasks),tasks
        assert sum(t['id'].startswith('code:') for t in tasks)==7
        assert sum(t['id'].startswith('video:') for t in tasks)==sum(bool(a.get('cover') and a['cover'].get('videoSrc')) for a in ALBUMS.values())
        assert not any('/archive/' in t['id'] for t in tasks)
        result['prepared_tasks']=len(tasks)
        result['video_preparation']=await page.evaluate('window.__portfolioVideoCache')
        result['startup_probe_failures']=list(failed);failed.clear()
        result['startup_bytes_from_files']=sum((ROOT/'dist'/p.lstrip('/')).stat().st_size for p in {p for _,p in server.requests} if (ROOT/'dist'/p.lstrip('/')).is_file())
        result['checks'].append('Every route, font, display image, zoom photograph and usable full-video player is prepared before reveal')
        server.unavailable=True;stamp=time.monotonic()
        if name.startswith('chromium'):await context.set_offline(True)
        result['network_mode']='browser-offline-and-origin-503' if name.startswith('chromium') else 'origin-503-no-routing-mocks'
        for route,album in ALBUMS.items():
            stage=route+': entry/scroll'
            if urlsplit(page.url).path.rstrip('/')!='/works':await page.locator('.menu-list a',has_text='WORKS').click()
            await page.locator('.works-route').wait_for()
            await page.locator(f'.works-route a.listing-link[href$="/{route}"]').click()
            await page.wait_for_url(re.compile(rf'/{route}/?$'));await page.locator('.album-masonry').wait_for()
            count=len(album['photos']);await checks.check_whole_album(page,count);await checks.fast_scroll(page,count)
            await page.screenshot(path=str(OUTPUT/f'{name}-{route}-last.png'),animations='disabled')
            stage=route+': viewer'
            await page.locator('a.js-gallery-link').last.click();await viewer_ready(page)
            assert await page.evaluate('window.pswp.currIndex')==count-1
            await page.evaluate('window.pswp.next()');await page.wait_for_function('window.pswp?.currIndex === 0');await viewer_ready(page)
            await page.locator('.pswp__button--close').click();await page.locator('.pswp').wait_for(state='detached')
            if album.get('cover') and album['cover'].get('videoSrc'):
                stage=route+': video'
                video=page.locator('video').first
                await video.scroll_into_view_if_needed()
                await page.wait_for_function('document.querySelector("video")?.readyState >= 2',timeout=15000)
                state=await video.evaluate('(v)=>({error:v.error?{code:v.error.code,message:v.error.message}:null,time:v.currentTime,width:v.videoWidth})')
                assert state['error'] is None and state['width']>0,state
            await page.go_back();await page.locator('.works-route').wait_for()
            result['checks'].append(f'{route}: all {count} photos at reveal, rapid scroll, final/first zoom photo, video and Back work without origin')
        stage='Home/Works/Contacts and homepage viewer'
        await page.locator('.menu-list a',has_text='CONTACTS').click();await page.wait_for_url(re.compile(r'/contacts/?$'))
        await page.locator('.menu-list a',has_text='HOME').click();await page.locator('#home-main').wait_for()
        photos=page.locator('#home-main .picture-section img');assert await photos.count()==8
        assert await photos.evaluate_all('(imgs)=>imgs.every(i=>i.complete&&i.naturalWidth>0&&getComputedStyle(i).opacity==="1")')
        for index in (0,7):
            await page.locator('#home-main a.home-gallery-link').nth(index).click();await viewer_ready(page)
            assert await page.evaluate('window.pswp.currIndex')==index
            await page.locator('.pswp__button--close').click();await page.locator('.pswp').wait_for(state='detached')
        assert await page.evaluate('window.__qaOverlays')==0
        assert await page.evaluate('window.__qaNativeTransitions')==0
        late=[p for t,p in server.requests if t>stamp];assert not late,f'Late requests: {late}'
        assert not errors,errors
        cancelled=[f for f in failed if f['type']=='media' and any(s in (f['reason'] or '').lower() for s in ('aborted','cancel'))]
        unexpected=[f for f in failed if f not in cancelled];assert not unexpected,unexpected
        result['cancelled_media_reads']=cancelled
        result['checks'].append('Zero later loading screens, native snapshots, origin requests or unexpected failed transfers')
        result['passed']=True
    except Exception as error:
        result.update(stage=stage,errors=errors+[str(error)],failed_requests=failed)
        try:
            result['tasks']=await page.evaluate('window.__portfolioLoading.tasks.filter(t=>t.state!=="ready")')
            result['video_preparation']=await page.evaluate('window.__portfolioVideoCache')
            await page.screenshot(path=str(OUTPUT/f'{name}-failure.png'),animations='disabled',timeout=5000)
        except Exception:pass
    finally:
        server.release.set();await context.close();server.close()
    return result
async def recovery(browser,partial_entry=False):
    server=Server(failure=True);context=await browser.new_context(viewport={'width':414,'height':896})
    page=await context.new_page();page.set_default_timeout(90000)
    result={'name':'explicit-partial-startup' if partial_entry else 'retry-last-photo','passed':False}
    try:
        await page.goto(server.base+'/',wait_until='domcontentloaded');await page.locator('#site-loader-retry').wait_for(state='visible')
        assert await page.locator('#site-loader').is_visible()
        assert int(await page.locator('#site-loader-progress').get_attribute('aria-valuenow'))<100
        if partial_entry:
            await page.locator('#site-loader-continue').click();await page.wait_for_function("document.documentElement.dataset.siteLoadState === 'degraded'")
            assert await page.evaluate("window.__portfolioLoading.tasks.some(t=>t.state==='error')")
        else:
            server.failure=False;server.release.set();await page.locator('#site-loader-retry').click();await ready(page)
            assert await page.evaluate("window.__portfolioLoading.tasks.every(t=>t.state==='ready')")
        result['passed']=True
    except Exception as error:result['error']=str(error)
    finally:
        server.release.set();await context.close();server.close()
    return result
async def main():
    OUTPUT.mkdir(parents=True,exist_ok=True);results=[]
    async with async_playwright() as p:
        for engine,name,mobile,entry in ((p.chromium,'chromium-desktop',False,'/'),(p.chromium,'chromium-mobile',True,'/contacts/'),(p.webkit,'webkit-mobile',True,'/portraits/')):
            browser=await engine.launch()
            try:
                result=await cold(browser,name,mobile,entry);results.append(result);print(json.dumps(result,ensure_ascii=False),flush=True)
                if name=='chromium-desktop':
                    for partial_entry in (False,True):
                        result=await recovery(browser,partial_entry);results.append(result);print(json.dumps(result,ensure_ascii=False),flush=True)
            finally:await browser.close()
    (OUTPUT/'report.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
    raise SystemExit(0 if all(item['passed'] for item in results) else 1)
if __name__=='__main__':asyncio.run(main())
