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
      const logo = document.querySelector('.home-site-logo')?.getBoundingClientRect()
      const title = document.querySelector('.home-hero-copy .cover-header')?.getBoundingClientRect()
      const subtitle = document.querySelector('.home-hero-copy > p')?.getBoundingClientRect()
      return {
        logo: logo && {top: logo.top, bottom: logo.bottom, left: logo.left, right: logo.right},
        title: title && {top: title.top, bottom: title.bottom},
        subtitle: subtitle && {top: subtitle.top, bottom: subtitle.bottom},
        innerLogoCount: document.querySelectorAll('.persistent-site-logo').length,
        wrapperClass: document.querySelector('.react-page-wrapper')?.className || '',
      }
    }""")
    assert geometry['logo'] and geometry['title'] and geometry['subtitle'], geometry
    upper = geometry['title']['top'] - geometry['logo']['bottom']
    lower = geometry['subtitle']['top'] - geometry['title']['bottom']
    assert abs(upper - 12) <= 1, f'{label}: PAVEL KAYLER -> slogan gap is not 12px: {upper}, {geometry}'
    assert abs(lower - 12) <= 1, f'{label}: slogan -> subtitle gap is not 12px: {lower}, {geometry}'
    assert abs(upper - lower) <= 1, f'{label}: home text gaps differ: upper={upper}, lower={lower}, {geometry}'
    assert geometry['innerLogoCount'] == 0, f'{label}: header logo must not be rendered on HOME: {geometry}'
    assert 'logo-transition-' not in geometry['wrapperClass'], f'{label}: transition class still present: {geometry}'
    print(f'PASS {label}: home logo gaps upper={upper:.2f}px lower={lower:.2f}px')

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
        await wait_ready(page)
        assert await page.locator('.home-site-logo').count() == 0, f'{label}: HOME logo leaked onto WORKS'
        assert await page.locator('.persistent-site-logo').count() == 1, f'{label}: static inner logo missing on WORKS'
        classes = await page.locator('.react-page-wrapper').get_attribute('class') or ''
        assert 'logo-transition-' not in classes, f'{label}: transition class present on WORKS: {classes}'
        animation = await page.locator('.persistent-site-logo').evaluate("el => getComputedStyle(el).animationName")
        assert animation == 'none', f'{label}: inner logo still animates: {animation}'
        first = await page.locator('.persistent-site-logo').bounding_box()
        await page.wait_for_timeout(650)
        second = await page.locator('.persistent-site-logo').bounding_box()
        assert first and second and abs(first['x'] - second['x']) <= .5 and abs(first['y'] - second['y']) <= .5, \
            f'{label}: inner logo moved after navigation: {first} -> {second}'

        await page.locator('.menu-list a', has_text='HOME').click()
        await page.wait_for_url(BASE + '/')
        await wait_ready(page)
        assert await page.locator('.persistent-site-logo').count() == 0, f'{label}: inner logo leaked back onto HOME'
        assert await page.locator('.home-site-logo').count() == 1, f'{label}: HOME logo missing after return'
        await check_home_geometry(page, label + '-return')
        print(f'PASS {label}: logo states switch instantly without positional animation')
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
