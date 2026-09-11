#!/usr/bin/env python3
from playwright.async_api import async_playwright

BASE = 'http://127.0.0.1:4173'

async def wait_ready(page):
    await page.wait_for_function("document.documentElement.dataset.siteLoadState !== undefined", timeout=90000)
    await page.locator('.page-header').wait_for(state='visible')
    await page.evaluate('document.fonts.ready')
    if await page.locator('.home-site-logo').count():
        await page.wait_for_function("document.querySelector('.home-site-logo .logo-image')?.naturalWidth > 0")
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
        await wait_ready(page)
        assert await page.locator('.home-site-logo').count() == 0, f'{label}: HOME logo leaked onto WORKS'
        assert await page.locator('.persistent-site-logo').count() == 0, f'{label}: header wordmark still rendered on WORKS'
        header_text = (await page.locator('.page-header').inner_text()).upper()
        assert 'PAVEL KAYLER' not in header_text, f'{label}: PAVEL KAYLER still appears in the header: {header_text}'

        await page.locator('.menu-list a', has_text='HOME').click()
        await page.wait_for_url(BASE + '/')
        await wait_ready(page)
        assert await page.locator('.persistent-site-logo').count() == 0, f'{label}: removed header wordmark returned on HOME'
        assert await page.locator('.home-site-logo').count() == 1, f'{label}: HOME logo missing after return'
        await check_home_geometry(page, label + '-return')
        print(f'PASS {label}: header has no PAVEL KAYLER wordmark; HOME logo remains unchanged')
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
    import asyncio
    asyncio.run(main())
