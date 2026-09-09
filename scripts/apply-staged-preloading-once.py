from pathlib import Path

# Only the isolated feature branch runs this transport helper. It is removed
# before review; maintained files are normal source, not generated during build.
def change(path, old, new, count=-1):
    file=Path(path); text=file.read_text()
    assert old in text, f'Expected baseline fragment missing: {path}'
    file.write_text(text.replace(old,new,count))

change('src/layouts/MainLayout.tsx', "import { SiteLogo }", "import { NavigationProgress } from '../components/NavigationProgress'\nimport { SiteLogo }")
change('src/layouts/MainLayout.tsx','      <Outlet />','      <NavigationProgress />\n      <Outlet />')
change('src/app/router.tsx',"import { createBrowserRouter }", "import { createBrowserRouter, type LoaderFunctionArgs }")
change('src/app/router.tsx','const basename =',"import { prepareNavigation } from './siteLoading'\n\nconst ready = (path: string) => ({ request }: LoaderFunctionArgs) => prepareNavigation(path, request.signal)\n\nconst basename =")
change('src/app/router.tsx','element: <MainLayout />,','element: <MainLayout />,\n      hydrateFallbackElement: null,')
change('src/app/router.tsx','{ index: true, element: <HomePage /> }',"{ index: true, element: <HomePage />, loader: ready('/') }")
for name in ('works','portraits','projects','brands','contacts'):
    change('src/app/router.tsx',f"lazy: lazyRoute('{name}')",f"lazy: lazyRoute('{name}'), loader: ready('/{name}')")
change('src/app/routeModules.ts','promise = loaders[key]()',"promise = loaders[key]().catch((error: unknown) => {\n      pending.delete(key)\n      throw error\n    })")
change('src/pages/HomePage.tsx','image={column.image}','image={column.image}\n                            loading="eager"')
for path in ('src/pages/HomePage.tsx','src/pages/WorksPage.tsx'):
    change(path,'image={card.image}','image={card.image} loading="eager"')
change('src/components/HomeSlider.tsx','useEffect, useState','useEffect, useState, useSyncExternalStore')
change('src/components/HomeSlider.tsx',"import type { HomeContent }","import { getInitialPhase, subscribeInitialPhase } from '../app/siteLoading'\nimport type { HomeContent }")
change('src/components/HomeSlider.tsx','  const reducedMotion = usePrefersReducedMotion()','  const reducedMotion = usePrefersReducedMotion()\n  const phase = useSyncExternalStore(subscribeInitialPhase, getInitialPhase)')
change('src/components/HomeSlider.tsx','if (reducedMotion || cover.slides.length < 2)',"if (phase === 'loading' || reducedMotion || cover.slides.length < 2)")
change('src/components/HomeSlider.tsx','[cover.delay, cover.slides.length, reducedMotion]','[cover.delay, cover.slides.length, reducedMotion, phase]')
change('src/components/HomeSlider.tsx',"loading={index === 0 ? 'eager' : 'lazy'}",'loading="eager"')
change('src/hooks/useHomePhotoGallery.ts',"import { useEffect, useRef } from 'react'","import { useEffect, useRef } from 'react'\nimport { requestImage } from '../app/imageResources'")
change('src/hooks/useHomePhotoGallery.ts','// Neither module is downloaded merely to display the homepage. Load both on\n      // first intent so a failed import can fall back to the actual image link.','// Startup warms both modules; retain local binding and opt-out recovery.')
change('src/hooks/useHomePhotoGallery.ts','if (lightbox || cancelled || event.defaultPrevented','if (cancelled || event.defaultPrevented')
change('src/hooks/useHomePhotoGallery.ts','      const links = Array.from',"      void requestImage(anchor.href, 0).catch(() => undefined)\n      if (lightbox) return\n      const links = Array.from")
change('src/components/NativeGallery.tsx','import Masonry',"import { requestImage } from '../app/imageResources'\nimport Masonry")
change('src/components/NativeGallery.tsx','void ensureLightbox()','void ensureLightbox().catch(() => undefined)',1)
change('src/components/NativeGallery.tsx','      if (lightbox || cancelled) return','      if (cancelled || event.defaultPrevented || event.button !== 0 ||\n          event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return')
change('src/components/NativeGallery.tsx','      event.preventDefault()',"      void requestImage(anchor.href, 0).catch(() => undefined)\n      if (lightbox) return\n      event.preventDefault()")
change('src/components/NativeGallery.tsx',"        if (!cancelled) instance?.loadAndOpen(index)\n      })", "        if (!cancelled) instance?.loadAndOpen(index)\n      }).catch(() => { if (!cancelled && anchor.isConnected) window.location.assign(anchor.href) })")
change('index.html','<span class="site-loader-spinner" aria-hidden="true"></span>','''<div class="site-loader-content">
        <span class="site-loader-spinner" aria-hidden="true"></span>
        <span id="site-loader-label">Подготовка сайта</span>
        <progress id="site-loader-progress" max="1" value="0" aria-label="Готовность сайта"></progress>
        <div id="site-loader-actions" hidden>
          <button id="site-loader-retry" type="button" hidden>Повторить загрузку</button>
          <button id="site-loader-continue" type="button">Открыть доступную часть сайта</button>
        </div>
      </div>''')
change('index.html','      #site-loader.is-hidden {','''      .site-loader-content { display: grid; justify-items: center; gap: 18px; padding: 24px; text-align: center; color: #eee; font: 14px/1.5 Arial, sans-serif; }
      #site-loader-progress { width: 180px; height: 3px; accent-color: #ddd; }
      #site-loader-actions[hidden], #site-loader-retry[hidden] { display: none; }
      #site-loader-actions { display: flex; gap: 12px; flex-wrap: wrap; justify-content: center; max-width: 400px; }
      #site-loader-actions button { color: #eee; background: #292929; border: 1px solid #666; padding: 10px 14px; border-radius: 4px; cursor: pointer; }
      #site-loader-actions button:disabled { opacity: .5; cursor: wait; }
      #site-loader.is-hidden {''')
p=Path('src/styles/app.css');p.write_text(p.read_text()+'''
/* Cached, decoded images do not replay a placeholder fade on route mount. */
.lazy-image.is-prepared img { transition: none !important; }
.route-loading-status {
  position: fixed; z-index: 9500; bottom: max(18px, env(safe-area-inset-bottom));
  left: 50%; transform: translateX(-50%); display: flex; flex-wrap: wrap;
  align-items: center; justify-content: center; gap: 12px; width: max-content;
  max-width: calc(100vw - 32px); padding: 12px 18px; background: rgba(25,25,25,.96);
  border: 1px solid #555; border-radius: 6px; color: #eee; font: 14px/1.5 Arial,sans-serif;
  animation: route-indicator-appear .2s both;
}
.route-loading-status .site-loader-spinner { width: 18px; height: 18px; }
.route-loading-actions { display: flex; gap: 12px; flex-wrap: wrap; justify-content: center; }
.route-loading-actions button { color: inherit; background: #333; border: 1px solid #777;
  border-radius: 4px; padding: 8px 12px; cursor: pointer; }
@keyframes route-indicator-appear { 0%, 90% { opacity: 0; } 100% { opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .route-loading-status { animation: none; } }
''')
change('scripts/run-browser-checks.sh','python3 scripts/cache-smoke.py','node --experimental-strip-types --test scripts/resource-queue.test.ts\npython3 scripts/cache-smoke.py\npython3 scripts/preload-smoke.py')
change('scripts/home_gallery_checks.py',"        link = p.locator('#home-main a.home-gallery-link').first\n        if mobile:","        await asyncio.wait_for(requested.wait(), timeout=10)\n        # Bypass the held startup viewer explicitly to test leave-mid-import recovery.\n        await p.locator('#site-loader-continue').click(timeout=20000)\n        link = p.locator('#home-main a.home-gallery-link').first\n        if mobile:")
change('scripts/browser-smoke.py',"        await page.locator('.page-header').wait_for(state='visible')", "        await page.wait_for_function(\"document.documentElement.dataset.siteLoadState !== undefined\", timeout=90000)\n        await page.locator('.page-header').wait_for(state='visible')")
change('src/content/loading-plan.ts',"export const routeName = (path: string) => ({ '/': 'Home', '/works': 'Works', '/contacts': 'Contacts',\n  '/portraits': 'Portraits', '/projects': 'Projects', '/brands': 'Brands' }[path] || 'страницы')", "const routeNames: Record<string, string> = { '/': 'Home', '/works': 'Works', '/contacts': 'Contacts',\n  '/portraits': 'Portraits', '/projects': 'Projects', '/brands': 'Brands' }\nexport const routeName = (path: string) => routeNames[path] || 'страницы'")
change('src/app/initialLoader.ts',"slow = true; actions.hidden = false", "slow = true; actions.hidden = false; continueButton.disabled = !document.querySelector('#root .react-route')")
p=Path('README.md');p.write_text(p.read_text().replace('`prefetch.ts` — предварительная загрузка.', '`loading-plan.ts` — полный план предварительной загрузки.')+'''

## Двухэтапная загрузка

Первый вход подготавливает всю Home (5 кадров слайдера, 8 фотографий, карточки),
все карточки Works, Contacts, логотип, шрифты и код просмотрщика. При прямой ссылке
на альбом добавляется его первый экран. Спиннер завершается по готовности ресурсов
и декодированию показываемых изображений, не по таймеру. При сбое доступны повтор
и явное открытие доступной части; этот режим отмечается как degraded, а не ready.

После раскрытия страницы единая очередь готовит первые экраны остальных разделов,
все изображения для их раскладки, крупные версии и видео. Две фоновые задачи
оставляют две свободные позиции для действий посетителя. Переход в неготовый раздел
сохраняет предыдущую страницу до готовности первого экрана. Новый выбор отменяет
устаревшее ожидание, но уже начатые загрузки могут закончиться и наполнить кэш.

Выбор варианта изображения общий для очереди и компонентов, с учётом размеров
окна и DPR; все варианты каждой фотографии одновременно не скачиваются. Фоновое
скачивание приостанавливается в скрытой вкладке/офлайн. Save-Data отключает только
предварительное скачивание тяжёлых zoom-версий и видео, не страниц. Service Worker
не установлен: применяется обычный HTTP-кэш браузера, который может быть вытеснен.

`resource-queue.test.ts` проверяет дедупликацию, приоритеты и восстановление;
`preload-smoke.py` — холодный кэш, удержанную последнюю фотографию, переключения
основных страниц, ранний переход в альбом, отмену устаревшего перехода и ошибку/повтор.
''')
Path(__file__).unlink()
