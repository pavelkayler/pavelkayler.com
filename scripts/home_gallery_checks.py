"""Homepage photo regressions, shared by pre-deploy and live browser runs."""
import asyncio
from urllib.parse import urlparse


async def check_home_gallery(page, browser, base, screenshot, swipe_next,
                             width, height, mobile, scroller_js):
    checks = []
    links = page.locator('#home-main .picture-section a.home-gallery-link')
    pictures = page.locator('#home-main .picture-section')
    count = await pictures.count()
    assert count == 8, f'Homepage picture inventory changed unexpectedly: {count}'
    assert await links.count() == count, 'Every homepage photograph must open the viewer'
    assert await page.locator('#home-main .listing .home-gallery-link').count() == 0

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

    # Test every picture, not just the first photo of a different route. Click
    # the visible image area through its link; use real touch taps on mobile.
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
        assert urlparse(page.url).path == '/', 'A photograph navigated away from home'
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
        assert abs(before_scroll-after_scroll) < 4, f'Closing jumped scroll: {before_scroll} -> {after_scroll}'
    checks.append('home: all 8 photos open the correct item; next, close and scroll preservation')

    # Category cards must remain navigation, not join the eight-image lightbox.
    cards = page.locator('#home-main .listing a.listing-link')
    assert await cards.count() == 3
    target = urlparse(await cards.first.evaluate('(el) => el.href')).path.rstrip('/')
    await cards.first.click()
    await page.wait_for_url(lambda url: urlparse(str(url)).path.rstrip('/') == target)
    assert await page.locator('.pswp--open').count() == 0
    await page.go_back()
    await links.first.wait_for(state='visible')
    assert urlparse(page.url).path == '/'
    await activate(links.nth(1))
    await ready(page)
    assert await page.evaluate('pswp.currIndex') == 1
    await page.locator('.pswp__button--close').click()
    await page.locator('.pswp').wait_for(state='detached')
    scroller = await page.evaluate_handle(scroller_js)
    await scroller.evaluate('(el) => { el.scrollTop = 0; }')
    checks.append('home: category navigation unchanged; viewer reinitializes after Back')

    # A cold context prevents a successful internal-gallery test from preloading
    # PhotoSwipe and accidentally masking the homepage's first-click failure.
    cold = await browser.new_context(viewport={'width':width,'height':height},
                                    is_mobile=mobile, has_touch=mobile)
    failures, delayed = [], []
    async def delay_module(route):
        if 'lightbox' in route.request.url.lower() and route.request.resource_type == 'script':
            delayed.append(route.request.url)
            await asyncio.sleep(2)
        await route.continue_()
    await cold.route('**/*', delay_module)
    p = await cold.new_page()
    p.set_default_timeout(30000)
    p.on('pageerror', lambda error: failures.append(str(error)))
    try:
        await p.goto(base+'/', wait_until='domcontentloaded')
        link = p.locator('#home-main a.home-gallery-link').nth(2)
        if mobile:
            await link.tap()
        else:
            await link.click()
        await ready(p)
        assert delayed, 'Cold test did not exercise the delayed module request'
        assert await p.evaluate('pswp.currIndex') == 2
        assert urlparse(p.url).path == '/'
        assert not failures, failures
    finally:
        await cold.close()
    checks.append('home: cold first click opens selected photo despite delayed PhotoSwipe download')

    # Leaving home during the first download must not open a stale lightbox on
    # the destination page. Keep the import pending until navigation completes.
    leaving = await browser.new_context(viewport={'width':width,'height':height},
                                       is_mobile=mobile, has_touch=mobile)
    release = asyncio.Event()
    requested = asyncio.Event()
    async def hold_module(route):
        if 'lightbox' in route.request.url.lower() and route.request.resource_type == 'script':
            requested.set()
            await release.wait()
        await route.continue_()
    await leaving.route('**/*', hold_module)
    p = await leaving.new_page()
    p.set_default_timeout(30000)
    try:
        await p.goto(base+'/', wait_until='domcontentloaded')
        link = p.locator('#home-main a.home-gallery-link').first
        if mobile:
            await link.tap()
        else:
            await link.click()
        await asyncio.wait_for(requested.wait(), timeout=10)
        await p.locator('.menu-list a', has_text='WORKS').click()
        await p.wait_for_url('**/works')
        release.set()
        await p.wait_for_timeout(800)
        assert await p.locator('.pswp--open').count() == 0
        assert urlparse(p.url).path.rstrip('/') == '/works'
    finally:
        release.set()
        await leaving.close()
    checks.append('home: pending viewer is cancelled when navigating away')
    return checks
