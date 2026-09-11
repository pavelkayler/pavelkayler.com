#!/usr/bin/env python3
import asyncio
from playwright.async_api import async_playwright

BASE = 'http://127.0.0.1:4173'

async def check_height(browser, height):
    page = await browser.new_page(viewport={"width": 1440, "height": height})
    try:
        await page.goto(BASE + '/works')
        await page.wait_for_function("document.documentElement.dataset.siteLoadState !== undefined", timeout=90000)
        await page.locator('.page-header').wait_for(state='visible')
        await page.evaluate('document.fonts.ready')
        await page.wait_for_timeout(300)
        geometry = await page.evaluate("""() => {
          const header = document.querySelector('.page-header').getBoundingClientRect()
          const title = document.querySelector('.works-page-title').getBoundingClientRect()
          const captions = [...document.querySelectorAll('.works-route .listing-title')]
            .map(el => el.getBoundingClientRect())
          const quote = document.querySelector('.works-route blockquote p:first-child').getBoundingClientRect()
          const wrapper = document.querySelector('.react-page-wrapper.is-works-route').getBoundingClientRect()
          return {
            headerBottom: header.bottom,
            titleTop: title.top,
            captionBottom: Math.max(...captions.map(rect => rect.bottom)),
            quoteTop: quote.top,
            wrapperHeight: wrapper.height,
            viewportHeight: innerHeight,
            scrollHeight: document.documentElement.scrollHeight,
          }
        }""")
        top_gap = geometry['titleTop'] - geometry['headerBottom']
        lower_gap = geometry['quoteTop'] - geometry['captionBottom']
        assert abs(top_gap - 38) <= 1, f'Header-to-Works gap is not 38px: {geometry}, gap={top_gap}'
        assert abs(lower_gap - 38) <= 1, f'Caption-to-quote gap is not 38px: {geometry}, gap={lower_gap}'
        assert abs(top_gap - lower_gap) <= 1, f'Works text gaps differ: top={top_gap}, lower={lower_gap}, geometry={geometry}'
        assert abs(geometry['wrapperHeight'] - geometry['viewportHeight']) <= 1, f'Works wrapper is not 100vh: {geometry}'
        assert geometry['scrollHeight'] <= geometry['viewportHeight'] + 2, f'Works page scrolls: {geometry}'
        print(f'PASS works spacing at 1440x{height}: top={top_gap:.2f}px lower={lower_gap:.2f}px')
    finally:
        await page.close()

async def main():
    async with async_playwright() as tool:
        browser = await tool.chromium.launch()
        try:
            for height in (850, 1000):
                await check_height(browser, height)
        finally:
            await browser.close()

if __name__ == '__main__':
    asyncio.run(main())
