#!/usr/bin/env python3
"""Check all mounted album photographs immediately after reveal, locally or on the domain."""
import argparse
import asyncio
import importlib.util
import json
from pathlib import Path
import re
from playwright.async_api import async_playwright

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('album_readiness_checks', HERE / 'album-readiness-smoke.py')
checks = importlib.util.module_from_spec(spec)
spec.loader.exec_module(checks)
SCROLLER = """() => [...document.querySelectorAll('*')].find(el =>
  el.clientWidth > innerWidth * .7 && el.clientHeight > innerHeight * .5 &&
  el.scrollHeight > el.clientHeight + 200 && /auto|scroll/.test(getComputedStyle(el).overflowY)
) || document.scrollingElement"""


async def exercise(browser, base, output, name, mobile):
    context = await browser.new_context(viewport={'width': 414 if mobile else 1440, 'height': 896 if mobile else 1000},
                                        is_mobile=mobile, has_touch=mobile, device_scale_factor=2 if mobile else 1)
    # Observe native calls, but do not swallow errors or stub their behavior. The
    # site uses a CSS fade now, avoiding the observed WebKit update-callback timeout.
    await context.add_init_script('''() => {}''')
    await context.add_init_script('''
      window.__qaNativeTransitions = 0;
      if (typeof document.startViewTransition === 'function') {
        const original = document.startViewTransition.bind(document);
        document.startViewTransition = (...args) => {
          window.__qaNativeTransitions += 1;
          return original(...args);
        };
      }
    ''')
    page = await context.new_page()
    page.set_default_timeout(60000)
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    result = {'name': name, 'base': base, 'passed': False, 'albums': []}
    try:
        await page.goto(base + '/', wait_until='domcontentloaded')
        await checks.startup_ready(page)
        for route in ('portraits', 'projects', 'brands'):
            await page.locator('.menu-list a', has_text='WORKS').click()
            await page.wait_for_url(re.compile(r'/works/?$'))
            await page.locator('.works-route').wait_for(state='visible')
            await page.locator('#route-loader').wait_for(state='hidden')
            await page.locator(f'.works-route a.listing-link[href$="/{route}"]').click()
            await page.wait_for_url(re.compile(rf'/{route}/?$'))
            # Await the page container, never await individual image loads.
            await page.locator('.album-masonry').wait_for(state='visible')
            await page.locator('#route-loader').wait_for(state='hidden')
            count = len(checks.album_data(route)['photos'])
            await checks.check_whole_album(page, count)
            assert await page.locator('.react-route').evaluate('(el) => getComputedStyle(el).animationName') == 'react-route-enter', 'Prepared route lost its CSS fade'
            scroller = await page.evaluate_handle(SCROLLER)
            for fraction in (.45, 1, .2, .9):
                offset = await scroller.evaluate('(el, f) => { el.scrollTop=(el.scrollHeight-el.clientHeight)*f; return el.scrollTop; }', fraction)
                assert offset > 100, 'Rapid-scroll check did not actually scroll'
                await page.evaluate('new Promise(resolve => requestAnimationFrame(resolve))')
                await checks.check_whole_album(page, count)
            last = page.locator('.album-masonry .piece').last
            await last.scroll_into_view_if_needed()
            await checks.check_whole_album(page, count)
            box = await last.bounding_box()
            assert box and box['y'] < (896 if mobile else 1000) and box['y'] + box['height'] > 0, 'Final photo is not visible'
            await page.screenshot(path=str(output / f'{name}-{route}-last-photo.png'), animations='disabled')
            result['albums'].append({'route': route, 'photos_ready_at_reveal': count, 'actual_fast_scroll': True})
        result['native_transition_calls'] = await page.evaluate('window.__qaNativeTransitions')
        assert result['native_transition_calls'] == 0, 'Navigation reintroduced a native snapshot callback'
        assert not errors, errors
        result['passed'] = True
    except Exception as error:
        result['errors'] = errors + [str(error)]
        try:
            await page.screenshot(path=str(output / f'{name}-failure.png'), animations='disabled', timeout=5000)
        except Exception:
            pass
    finally:
        await context.close()
    return result


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--base', required=True)
    parser.add_argument('--output', default='test-results/browser/album-scroll')
    args = parser.parse_args()
    output = Path(args.output)
    output.mkdir(parents=True, exist_ok=True)
    results = []
    async with async_playwright() as tool:
        for engine, name, mobile in ((tool.chromium, 'chromium-desktop', False), (tool.chromium, 'chromium-mobile', True), (tool.webkit, 'webkit-mobile', True)):
            browser = await engine.launch()
            try:
                result = await exercise(browser, args.base.rstrip('/'), output, name, mobile)
                results.append(result)
                print(json.dumps(result, ensure_ascii=False), flush=True)
            finally:
                await browser.close()
    (output / 'report.json').write_text(json.dumps(results, indent=2, ensure_ascii=False))
    raise SystemExit(0 if all(result['passed'] for result in results) else 1)


if __name__ == '__main__':
    asyncio.run(main())
