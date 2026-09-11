#!/usr/bin/env python3
import asyncio
from playwright.async_api import async_playwright

BASE = 'http://127.0.0.1:4173'

async def wait_ready(page):
    await page.wait_for_function("document.documentElement.dataset.siteLoadState !== undefined", timeout=90000)
    await page.locator('.page-header').wait_for(state='visible')
    await page.evaluate('document.fonts.ready')
    await page.wait_for_function("document.querySelector('.logo-image')?.naturalWidth > 0")
    await page.wait_for_timeout(250)

async def check_home_geometry(page, label):
    geometry = await page.evaluate("""() => {
      const logoEl = document.querySelector('.home-site-logo')
      const titleEl = document.querySelector('.home-hero-copy .cover-header')
      const subtitleEl = document.querySelector('.home-hero-copy > p')
      const logo = logoEl?.getBoundingClientRect()
      const title = titleEl?.getBoundingClientRect()
      const subtitle = subtitleEl?.getBoundingClientRect()
      return {
        logo: logo && {top: logo.top, bottom: logo.bottom, left: logo.left, right: logo.right},
        title: title && {top: title.top, bottom: title.bottom},
        titlePaddingTop: titleEl ? parseFloat(getComputedStyle(titleEl).paddingTop) || 0 : 0,
        subtitle: subtitle && {top: subtitle.top, bottom: subtitle.bottom},
        innerLogoCount: document.querySelectorAll('.persistent-site-logo').length,
        wrapperClass: document.querySelector('.react-page-wrapper')?.className || '',
      }
    }""")
    assert geometry['logo'] and geometry['title'] and geometry['subtitle'], geometry

    # The Wfolio theme puts 60px padding above the cover h1. Compare against the
    # visible text edge rather than the h1 border box, which was the old false-positive.
    visible_title_top = geometry['title']['top'] + geometry['titlePaddingTop']
    upper = visible_title_top - geometry['logo']['bottom']
    lower = geometry['subtitle']['top'] - geometry['title']['bottom']
    assert abs(upper - 12) <= 1, f'{label}: visible PAVEL KAYLER -> slogan gap is not 12px: {upper}, {geometry}'
    assert abs(lower - 12) <= 1, f'{label}: slogan -> subtitle gap is not 12px: {lower}, {geometry}'
    assert abs(upper - lower) <= 1, f'{label}: visible home text gaps differ: upper={upper}, lower={lower}, {geometry}'
    assert geometry['innerLogoCount'] == 0, f'{label}: header logo must not be rendered on HOME: {geometry}'
    assert 'logo-transition-' not in geometry['wrapperClass'], f'{label}: positional transition class still present: {geometry}'
    print(f'PASS {label}: visible home logo gaps upper={upper:.2f}px lower={lower:.2f}px')

async def check_viewport(browser, width, height, label, mobile=False):
    context = await browser.new_context(viewport={"width": width, "height": height},
                                        is_mobile=mobile, has_touch=mobile, device_scale_factor=1)
    page = await context.new_page()
    page.set_default_timeout(30000)
    try:
        await page.goto(BASE + '/')
        await wait_ready(page)
        await check_home_geometry(page, label)

        await page.locator('.menu-list a', has_text='WORKS').click()
        await page.wait_for_url('**/works')
        inner_logo = page.locator('.persistent-site-logo')
        await inner_logo.wait_for(state='attached')
        assert await page.locator('.home-site-logo').count() == 0, f'{label}: HOME logo leaked onto WORKS'
        assert await inner_logo.count() == 1, f'{label}: static inner logo missing on WORKS'
        classes = await page.locator('.react-page-wrapper').get_attribute('class') or ''
        assert 'logo-transition-' not in classes, f'{label}: positional transition class present on WORKS: {classes}'
        logo_classes = await inner_logo.get_attribute('class') or ''
        assert 'header-logo-fade-in' in logo_classes, f'{label}: HOME -> WORKS did not request the header opacity fade: {logo_classes}'
        animation = await inner_logo.evaluate("el => getComputedStyle(el).animationName")
        assert animation == 'header-logo-opacity-in', f'{label}: wrong header logo animation: {animation}'

        first_transform = await inner_logo.evaluate("el => getComputedStyle(el).transform")
        first = await inner_logo.bounding_box()
        await page.wait_for_timeout(120)
        middle_transform = await inner_logo.evaluate("el => getComputedStyle(el).transform")
        middle = await inner_logo.bounding_box()
        await page.wait_for_timeout(450)
        last_transform = await inner_logo.evaluate("el => getComputedStyle(el).transform")
        second = await inner_logo.bounding_box()
        opacity = float(await inner_logo.evaluate("el => getComputedStyle(el).opacity"))
        assert first and middle and second, f'{label}: missing header-logo geometry during fade'
        assert first_transform == middle_transform == last_transform, \
            f'{label}: header logo transform changed during opacity fade: {first_transform} -> {middle_transform} -> {last_transform}'
        for before, after in ((first, middle), (middle, second)):
            assert abs(before['x'] - after['x']) <= .5 and abs(before['y'] - after['y']) <= .5, \
                f'{label}: header logo moved during opacity fade: {first} -> {middle} -> {second}'
        assert opacity >= .99, f'{label}: header logo did not finish fading in: opacity={opacity}'

        await wait_ready(page)
        await page.locator('.menu-list a', has_text='HOME').click()
        await page.wait_for_url(BASE + '/')
        await wait_ready(page)
        assert await page.locator('.persistent-site-logo').count() == 0, f'{label}: inner logo leaked back onto HOME'
        assert await page.locator('.home-site-logo').count() == 1, f'{label}: HOME logo missing after return'
        await check_home_geometry(page, label + '-return')
        print(f'PASS {label}: inner logo fades in by opacity only; no positional travel')
    finally:
        await context.close()

async def main():
    async with async_playwright() as tool:
        browser = await tool.chromium.launch()
        try:
            await check_viewport(browser, 1440, 1000, 'desktop')
            await check_viewport(browser, 414, 896, 'mobile', mobile=True)
        finally:
            await browser.close()

if __name__ == '__main__':
    asyncio.run(main())
