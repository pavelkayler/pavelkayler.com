#!/usr/bin/env python3
"""Regression checks for a built site. Requires playwright==1.57.0.
Usage: python scripts/browser-smoke.py --base http://127.0.0.1:4173
Reports and screenshots are saved even when an assertion fails.
"""
import argparse
import asyncio
import json
import os
from pathlib import Path
from urllib.parse import urlparse
from playwright.async_api import async_playwright

SCROLLER = """() => [...document.querySelectorAll('*')].find(el =>
  el.clientWidth > innerWidth * .7 && el.clientHeight > innerHeight * .5 &&
  el.scrollHeight > el.clientHeight + 200 && /auto|scroll/.test(getComputedStyle(el).overflowY)
) || document.scrollingElement"""

async def exercise(browser, base, output, name, width, height, mobile=False):
    context = await browser.new_context(viewport={"width":width,"height":height},
        is_mobile=mobile, has_touch=mobile, device_scale_factor=1, reduced_motion="reduce")
    page = await context.new_page()
    page.set_default_timeout(20000)
    page.set_default_navigation_timeout(60000)
    failures, checks = [], []
    page.on('pageerror', lambda error: failures.append('JavaScript: '+str(error)))
    def response_check(response):
        if response.status >= 400 and response.request.resource_type in ('image','stylesheet','script','font'):
            failures.append(f'HTTP {response.status}: {response.url}')
    page.on('response', response_check)

    async def screenshot(label):
        await page.screenshot(path=str(output/f'{name}-{label}.png'), animations='disabled')

    async def settled():
        await page.locator('.page-header').wait_for(state='visible')
        await page.evaluate('document.fonts.ready')
        await page.wait_for_timeout(400)
        assert not await page.evaluate('document.documentElement.scrollWidth > innerWidth + 2'), 'Horizontal page overflow'
        await page.wait_for_function("document.querySelector('.logo-image')?.naturalWidth > 0")

    async def swipe_next():
        # Pointer dragging exercises the gallery gesture handler in both Chromium
        # and WebKit; no hidden mobile arrow is forced into view for the test.
        await page.mouse.move(width*.8, height*.55)
        await page.mouse.down()
        await page.mouse.move(width*.2, height*.55, steps=12)
        await page.mouse.up()

    try:
        await page.goto(base+'/')
        await settled()
        assert await page.locator('.menu-list [aria-current="page"]').inner_text() == 'HOME'
        assert await page.locator('.menu-list a', has_text='HOME').count() == 0
        if mobile:
            cover = await page.locator('.cover.-fullscreen').first.bounding_box()
            assert cover and cover['height'] >= height-5, f'Hero does not fill viewport: {cover}'
            logo = await page.locator('.js-logo').bounding_box()
            assert logo and logo['width'] > 150, f'Home logo should remain large: {logo}'
        await screenshot('home')
        checks.append('home hero and inactive current menu')

        await page.locator('.menu-list a', has_text='WORKS').click()
        await page.wait_for_url('**/works')
        await settled()
        assert await page.locator('.menu-list [aria-current="page"]').inner_text() == 'WORKS'
        assert await page.locator('.menu-list a', has_text='WORKS').count() == 0
        await screenshot('works')
        if mobile:
            before = await page.locator('.js-logo').bounding_box()
            scroller = await page.evaluate_handle(SCROLLER)
            moved = await scroller.evaluate('(el) => { el.scrollTop = 600; return el.scrollTop; }')
            assert moved > 100, 'Scroll test did not actually move the page'
            await page.wait_for_timeout(300)
            after = await page.locator('.js-logo').bounding_box()
            assert before and after and abs(after['y']-before['y']) < 3, f'Inner logo moved: {before} -> {after}'
            assert after['width'] < 140, 'Inner logo should be compact'
            await screenshot('works-scrolled')
        checks.append('works navigation, inactive menu and fixed inner logo')

        await page.locator('.menu-list a', has_text='CONTACTS').click()
        await page.wait_for_url('**/contacts')
        await settled()
        assert await page.locator('.menu-list [aria-current="page"]').inner_text() == 'CONTACTS'
        await screenshot('contacts')
        await page.go_back()
        assert urlparse(page.url).path.rstrip('/') == '/works', page.url
        await page.reload()
        await settled()
        checks.append('contacts, back navigation and direct route reload')

        for route in ('portraits','projects','brands'):
            await page.goto(base+'/'+route+'/')
            link = page.locator('a.js-gallery-link').first
            await link.wait_for(state='visible')
            await link.click()
            await page.locator('.pswp--open').wait_for(state='visible')
            await page.wait_for_function("[...document.querySelectorAll('.pswp__img')].some(img => img.naturalWidth > 0)")
            counter = page.locator('.pswp__counter')
            before = await counter.text_content()
            if mobile:
                await swipe_next()
            else:
                await page.locator('.pswp__button--arrow--next').click()
            await page.wait_for_function("old => document.querySelector('.pswp__counter')?.textContent !== old", arg=before)
            await screenshot(route+'-lightbox')
            await page.locator('.pswp__button--close').click()
            await page.locator('.pswp--open').wait_for(state='hidden')
            assert urlparse(page.url).path.rstrip('/') == '/'+route
            await screenshot(route)
            checks.append(route+': first click, next image gesture/control, close, return to gallery')

        early = await browser.new_context(viewport={"width":width,"height":height}, is_mobile=mobile, has_touch=mobile)
        async def delay_lightbox(route):
            if 'lightbox' in route.request.url.lower() and route.request.resource_type == 'script':
                await asyncio.sleep(2)
            await route.continue_()
        await early.route('**/*', delay_lightbox)
        p = await early.new_page()
        p.on('pageerror', lambda error: failures.append('Early click JavaScript: '+str(error)))
        await p.goto(base+'/portraits/', wait_until='domcontentloaded')
        await p.locator('a.js-gallery-link').first.click()
        await p.locator('.pswp--open').wait_for(state='visible', timeout=30000)
        assert urlparse(p.url).path.rstrip('/') == '/portraits'
        await early.close()
        checks.append('cold first click with delayed lightbox controller')
        assert not failures, '\n'.join(failures)
        return {'name':name,'passed':True,'checks':checks,'errors':[]}
    except Exception as error:
        try:
            await screenshot('failure')
        except Exception:
            pass
        return {'name':name,'passed':False,'checks':checks,'errors':failures+[str(error)]}
    finally:
        await context.close()

async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--base', default='http://127.0.0.1:4173')
    parser.add_argument('--output', default='test-results/browser')
    args = parser.parse_args()
    output = Path(args.output)
    output.mkdir(parents=True, exist_ok=True)
    results = []
    async with async_playwright() as tool:
        browser = await tool.chromium.launch()
        for name,width,height,mobile in [('desktop',1440,1000,False),('mobile-414',414,896,True),('mobile-360',360,800,True)]:
            result = await exercise(browser,args.base.rstrip('/'),output,name,width,height,mobile)
            results.append(result)
            print(json.dumps(result,ensure_ascii=False),flush=True)
        await browser.close()
        if os.environ.get('QA_WEBKIT') == '1':
            browser = await tool.webkit.launch()
            result = await exercise(browser,args.base.rstrip('/'),output,'webkit-mobile',414,896,True)
            results.append(result)
            print(json.dumps(result,ensure_ascii=False),flush=True)
            await browser.close()
    (output/'report.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
    raise SystemExit(0 if all(item['passed'] for item in results) else 1)

if __name__ == '__main__':
    asyncio.run(main())
