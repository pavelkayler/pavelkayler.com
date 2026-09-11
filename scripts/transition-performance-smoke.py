#!/usr/bin/env python3
"""Regression gate for cold route transitions and first-frame main-thread work."""
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
    assert first_frames_ms < 700, f'{label}: first frames took {first_frames_ms:.1f}ms'
    assert maximum < 250, f'{label}: main-thread long task reached {maximum:.1f}ms'
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
        video_requests = []
        page.on('request', lambda request: video_requests.append(request.url) if '/media/video/' in request.url else None)
        try:
            await page.goto(BASE + '/')
            await settle(page)

            assert await page.locator('.lazy-image canvas.placeholder').count() == 0, 'Full-resolution canvas placeholders returned'
            assert await page.locator('.lazy-image > div.placeholder').count() > 0, 'CSS image placeholders are missing'
            route_animation = await page.locator('.react-route').evaluate('el => getComputedStyle(el).animationName')
            assert route_animation == 'none', f'Whole-route animation is still active: {route_animation}'
            assert await page.locator('.route-transition-shield').count() == 1, 'Viewport transition shield missing'

            # Let automatic site warm-up run. HOME may prepare its own next slider
            # frame, but unrelated route photographs must remain untouched until intent.
            await page.wait_for_timeout(2200)
            speculative_images = await page.evaluate("""() =>
              (window.__portfolioLoading?.tasks || []).filter(task =>
                task.id.startsWith('image:') && task.priority > 10)
            """)
            unrelated_images = [task for task in speculative_images if '/media/images/home/' not in task['id']]
            assert unrelated_images == [], f'Background route image warm-up returned: {unrelated_images}'

            # Add real latency to image requests after HOME is ready. Route rendering
            # must remain responsive because navigation never waits for image decode.
            async def delay_images(route):
                await asyncio.sleep(0.12)
                await route.continue_()
            await page.route('**/media/images/**', delay_images)

            results = []
            results.append(await measure(
                page,
                lambda: page.locator('.menu-list a', has_text='WORKS').evaluate('el => el.click()'),
                '**/works', '.works-route', 'HOME -> WORKS cold images'))

            video_requests.clear()
            results.append(await measure(
                page,
                lambda: page.locator('.works-route a.listing-link[href$="/portraits"]').evaluate('el => el.click()'),
                '**/portraits', '.album-masonry', 'WORKS -> PORTRAITS cold images'))

            gallery = page.locator('.album-masonry')
            mounted = int(await gallery.get_attribute('data-mounted-count') or 0)
            total = int(await gallery.get_attribute('data-total-count') or 0)
            assert total > 12, f'Expected a long album, got {total} items'
            assert mounted <= 12, f'Cold album mounted {mounted}/{total} items before first frame'

            # Neither the cover video nor PhotoSwipe should compete with the first route frame.
            await page.wait_for_timeout(300)
            assert video_requests == [], f'Cover video started during the critical transition: {video_requests}'
            lightbox_resources = await page.evaluate("""() => performance.getEntriesByType('resource')
              .map(entry => entry.name).filter(name => name.includes('photoswipe-lightbox'))""")
            assert lightbox_resources == [], f'PhotoSwipe loaded without gallery intent: {lightbox_resources}'

            await page.wait_for_function("""() => {
              const gallery = document.querySelector('.album-masonry')
              return gallery && gallery.dataset.mountedCount === gallery.dataset.totalCount
            }""", timeout=5000)
            await page.wait_for_timeout(900)
            assert any('/media/video/portraits-cover.mp4' in url for url in video_requests), 'Deferred portrait video never started'

            assert await page.locator('.lazy-image canvas.placeholder').count() == 0, 'Album recreated canvas placeholders'
            route_animation = await page.locator('.react-route').evaluate('el => getComputedStyle(el).animationName')
            assert route_animation == 'none', f'Album route animation is still active: {route_animation}'
            print(json.dumps({'passed': True, 'results': results,
                              'initial_album_items': mounted, 'album_items': total,
                              'video_requests_after_defer': len(video_requests)}, ensure_ascii=False), flush=True)
        finally:
            await context.close()
            await browser.close()

if __name__ == '__main__':
    asyncio.run(main())
