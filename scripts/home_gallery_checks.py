"""Homepage photo regressions, shared by pre-deploy and live browser runs."""
import asyncio
import traceback
from urllib.parse import urlparse
from delayed_module_origin import DelayedModuleOrigin


async def check_home_gallery(*args, **kwargs):
    try:
        return await _check_home_gallery(*args, **kwargs)
    except Exception as error:
        raise AssertionError(traceback.format_exc()) from error


async def _check_home_gallery(page, browser, base, screenshot, swipe_next,
                              width, height, mobile, scroller_js):
    checks = []
    def completed(message):
        checks.append(message)
        print(f'PASS {width}px {message}', flush=True)

    links = page.locator('#home-main .picture-section a.home-gallery-link')
    pictures = page.locator('#home-main .picture-section')
    count = await pictures.count()
    assert count == 8, f'Homepage picture inventory changed unexpectedly: {count}'
    assert await links.count() == count, 'Every homepage photograph must open the viewer'
    assert await page.locator('#home-main .listing .home-gallery-link').count() == 0, 'Category cards joined the photo viewer'

    async def activate(link, keyboard=False):
        if mobile:
            await link.tap()
        elif keyboard:
            await link.focus()
            await link.press('Enter')
        else:
            await link.click()

    async def ready(p):
        await p.locator('.pswp--open').wait_for(state='visible')
        await p.wait_for_function('window.pswp?.opener?.isOpen === true')
        await p.wait_for_function('window.pswp?.currSlide?.content?.element?.naturalWidth > 0')
        assert await p.locator('.pswp').count() == 1, 'Duplicate lightbox instances'

    for index in range(count):
        link = links.nth(index)
        await link.scroll_into_view_if_needed()
        await page.wait_for_timeout(80)
        scroller = await page.evaluate_handle(scroller_js)
        before_scroll = await scroller.evaluate('(el) => el.scrollTop')
        expected_src = await link.evaluate('(el) => el.href')
        await activate(link, keyboard=index == 4)
        await ready(page)
        state = await page.evaluate('({index:pswp.currIndex,count:pswp.getNumItems(),src:pswp.currSlide.data.src})')
        assert state == {'index':index,'count':count,'src':expected_src}, state
        assert urlparse(page.url).path == '/', f'Photo {index+1} navigated away: {page.url}'
        if index in (0, 2, count-1):
            await screenshot(f'home-photo-{index+1}-lightbox')
        if index == 0:
            if mobile:
                await swipe_next()
            else:
                await page.locator('.pswp__button--arrow--next').click()
            await page.wait_for_function('window.pswp?.currIndex === 1')
            await page.wait_for_function('window.pswp?.currSlide?.content?.element?.naturalWidth > 0')
        close = page.locator('.pswp__button--close')
        if mobile:
            await close.tap()
        else:
            await close.click()
        await page.locator('.pswp').wait_for(state='detached')
        after_scroll = await scroller.evaluate('(el) => el.scrollTop')
        assert abs(before_scroll-after_scroll) < 4, f'Photo {index+1} closing jumped scroll: {before_scroll} -> {after_scroll}'
    completed('home: all 8 photos open the correct item; next, close and scroll preservation')

    cards = page.locator('#home-main .listing a.listing-link')
    assert await cards.count() == 3, 'Expected three unchanged category navigation cards'
    target = urlparse(await cards.first.evaluate('(el) => el.href')).path.rstrip('/')
    await cards.first.click()
    await page.wait_for_url(lambda url: urlparse(str(url)).path.rstrip('/') == target)
    await page.locator('#home-main').wait_for(state='detached')
    await page.locator('a.js-gallery-link').first.wait_for(state='visible')
    await page.wait_for_timeout(400)
    assert await page.locator('.pswp--open').count() == 0, 'Category card opened a photo instead of navigating'
    await page.go_back()
    await page.wait_for_url(base+'/')
    await links.first.wait_for(state='visible')
    await page.wait_for_function("document.querySelector('.menu-list [aria-current=page]')?.textContent === 'HOME'")
    await page.wait_for_timeout(400)
    await activate(links.nth(1))
    await ready(page)
    returned_index = await page.evaluate('pswp.currIndex')
    assert returned_index == 1, f'Wrong photo after Back: {returned_index}'
    await page.locator('.pswp__button--close').click()
    await page.locator('.pswp').wait_for(state='detached')
    scroller = await page.evaluate_handle(scroller_js)
    await scroller.evaluate('(el) => { el.scrollTop = 0; }')
    completed('home: category navigation unchanged; viewer reinitializes after Back')

    # Delay the real module response rather than relying on Playwright request routing.
    cold_origin = DelayedModuleOrigin(base, delay=2)
    cold = await browser.new_context(viewport={'width':width,'height':height},
                                    is_mobile=mobile, has_touch=mobile)
    failures = []
    p = await cold.new_page()
    p.set_default_timeout(90000)
    p.on('pageerror', lambda error: failures.append(str(error)))
    try:
        await p.goto(cold_origin.base+'/', wait_until='domcontentloaded')
        link = p.locator('#home-main a.home-gallery-link').nth(2)
        if mobile:
            await link.tap()
        else:
            await link.click()
        await ready(p)
        assert cold_origin.delayed, 'Cold test did not exercise the delayed module response'
        index = await p.evaluate('pswp.currIndex')
        assert index == 2, f'Cold first click selected {index}, expected 2'
        assert urlparse(p.url).path == '/', f'Cold photo navigated away: {p.url}'
        assert not failures, failures
    finally:
        await cold.close()
        cold_origin.close()
    completed('home: first click survives HTTP-delayed PhotoSwipe and opens the selected photo')

    leaving_origin = DelayedModuleOrigin(base, hold=True)
    leaving = await browser.new_context(viewport={'width':width,'height':height},
                                       is_mobile=mobile, has_touch=mobile)
    p = await leaving.new_page()
    p.set_default_timeout(30000)
    leaving_errors = []
    p.on('pageerror', lambda error: leaving_errors.append(str(error)))
    try:
        await p.goto(leaving_origin.base+'/', wait_until='domcontentloaded')
        # PhotoSwipe is intentionally no longer a startup dependency. Let the current
        # Home first screen become usable, then create a genuinely pending viewer import
        # with the first photo click.
        await p.wait_for_function("document.documentElement.dataset.siteLoadState === 'ready'")
        await p.locator('#site-loader').wait_for(state='hidden')
        link = p.locator('#home-main a.home-gallery-link').first
        if mobile:
            await link.tap()
        else:
            await link.click()
        assert await asyncio.to_thread(leaving_origin.requested.wait, 30), 'First click did not request the held viewer module'
        assert urlparse(p.url).path == '/', 'Pending viewer escaped to the JPG'
        await p.locator('.menu-list a', has_text='WORKS').click()
        await p.wait_for_url('**/works')
        await p.locator('#home-main').wait_for(state='detached')
        leaving_origin.release.set()
        await p.wait_for_timeout(800)
        assert await p.locator('.pswp--open').count() == 0, 'Stale homepage viewer opened after leaving home'
        assert urlparse(p.url).path.rstrip('/') == '/works', f'Pending click changed destination: {p.url}'
        assert not leaving_errors, leaving_errors
    finally:
        leaving_origin.release.set()
        await leaving.close()
        leaving_origin.close()
    completed('home: pending viewer is cancelled when navigating away during an HTTP-held module response')
    return checks
