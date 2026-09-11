#!/usr/bin/env python3
"""Cheap regression gate for route-transition main-thread work."""
import asyncio
import json
from playwright.async_api import async_playwright

BASE = 'http://127.0.0.1:4173'

async def settle(page):
    await page.wait_for_function("document.documentElement.dataset.siteLoadState === 'ready'", timeout=90000)
    await page.locator('.page-header').wait_for(state='visible')
    await page.locator('#site-loader').wait_for(state='hidden')
    await page.evaluate('document.fonts.ready')
    await page.wait_for_timeout(100)

async def two_frames(page):
    return await page.evaluate("""() => new Promise(resolve =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve(performance.now() - window.__routeStart))))
    """)

async def measure(page, click, url_pattern, ready_selector, label):
    await page.evaluate("""() => {
      window.__routeStart = performance.now()
      window.__routeLongTasks = []
    }""")
    await click()
    await page.wait_for_url(url_pattern)
    await page.locator(ready_selector).wait_for(state='visible')
    first_frames_ms = float(await two_frames(page))
    await page.wait_for_timeout(220)
    long_tasks = await page.evaluate('window.__routeLongTasks || []')
    maximum = max(long_tasks or [0])
    assert first_frames_ms < 1000, f'{label}: first frames took {first_frames_ms:.1f}ms'
    assert maximum < 500, f'{label}: main-thread long task reached {maximum:.1f}ms'
    return {'transition': label, 'first_frames_ms': round(first_frames_ms, 1),
            'max_long_task_ms': round(maximum, 1), 'long_tasks': len(long_tasks)}

async def main():
    async with async_playwright() as tool:
        browser = await tool.chromium.launch()
        context = await browser.new_context(viewport={'width': 1440, 'height': 1000})
        await context.add_init_script("""
          window.__routeLongTasks = [];
          try {
            new PerformanceObserver(list => {
              window.__routeLongTasks.push(...list.getEntries().map(entry => entry.duration));
            }).observe({entryTypes: ['longtask']});
          } catch {}
        """)
        page = await context.new_page()
        page.set_default_timeout(30000)
        try:
            await page.goto(BASE + '/')
            await settle(page)

            assert await page.locator('.lazy-image canvas.placeholder').count() == 0, 'Full-resolution canvas placeholders returned'
            assert await page.locator('.lazy-image > div.placeholder').count() > 0, 'CSS image placeholders are missing'
            route_animation = await page.locator('.react-route').evaluate('el => getComputedStyle(el).animationName')
            assert route_animation == 'none', f'Whole-route animation is still active: {route_animation}'
            assert await page.locator('.route-transition-shield').count() == 1, 'Viewport transition shield missing'

            results = []
            results.append(await measure(
                page,
                lambda: page.locator('.menu-list a', has_text='WORKS').click(),
                '**/works', '.works-route', 'HOME -> WORKS'))
            results.append(await measure(
                page,
                lambda: page.locator('.works-route a.listing-link[href$="/portraits"]').click(),
                '**/portraits', '.album-masonry', 'WORKS -> PORTRAITS'))

            assert await page.locator('.lazy-image canvas.placeholder').count() == 0, 'Album recreated canvas placeholders'
            route_animation = await page.locator('.react-route').evaluate('el => getComputedStyle(el).animationName')
            assert route_animation == 'none', f'Album route animation is still active: {route_animation}'
            print(json.dumps({'passed': True, 'results': results}, ensure_ascii=False), flush=True)
        finally:
            await context.close()
            await browser.close()

if __name__ == '__main__':
    asyncio.run(main())
