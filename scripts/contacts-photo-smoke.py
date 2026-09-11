#!/usr/bin/env python3
import asyncio
from playwright.async_api import async_playwright

BASE = 'http://127.0.0.1:4173'

async def assert_photo(page, label):
    photo = page.locator('.contacts-photo .lazy-image')
    await photo.wait_for(state='visible')
    await page.wait_for_function("""() => {
      const host = document.querySelector('.contacts-photo .lazy-image')
      const image = host?.querySelector('img')
      if (!host || !image || image.naturalWidth <= 0) return false
      const rect = host.getBoundingClientRect()
      return rect.width > 150 && rect.height > 150
    }""", timeout=30000)
    geometry = await photo.evaluate("""host => {
      const rect = host.getBoundingClientRect()
      const image = host.querySelector('img')
      return { width: rect.width, height: rect.height, naturalWidth: image?.naturalWidth || 0 }
    }""")
    assert geometry['width'] > 150 and geometry['height'] > 150 and geometry['naturalWidth'] > 0, geometry
    print(f"PASS {label}: contact portrait {geometry['width']:.1f}x{geometry['height']:.1f}, naturalWidth={geometry['naturalWidth']}")

async def check(browser, width, height):
    context = await browser.new_context(viewport={'width': width, 'height': height}, is_mobile=width <= 768, has_touch=width <= 768)
    page = await context.new_page()
    page.set_default_timeout(30000)
    try:
        # Direct cold entry must have a real, non-collapsed portrait.
        await page.goto(BASE + '/contacts')
        await page.wait_for_function("document.documentElement.dataset.siteLoadState !== undefined", timeout=90000)
        await assert_photo(page, f'{width}px direct')

        # The common in-app path must preserve the same geometry after intent prefetch.
        await page.goto(BASE + '/works')
        await page.locator('.menu-list a', has_text='CONTACTS').click()
        await page.wait_for_url('**/contacts')
        await assert_photo(page, f'{width}px navigation')
    finally:
        await context.close()

async def main():
    async with async_playwright() as tool:
        browser = await tool.chromium.launch()
        try:
            await check(browser, 1440, 1000)
            await check(browser, 414, 896)
        finally:
            await browser.close()

if __name__ == '__main__':
    asyncio.run(main())
