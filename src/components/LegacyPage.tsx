import { useEffect, useMemo, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Masonry from 'masonry-layout'
import PhotoSwipeLightbox from 'photoswipe/lightbox'
import { pages, type PageKey } from '../generated/pages'
import { prefetchRoute } from '../app/prefetch'

function withBase(value: string) {
  const base = import.meta.env.BASE_URL
  return value.replaceAll('__BASE__', base)
}

function upsertMeta(name: string, content: string) {
  let meta = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)
  if (!meta) {
    meta = document.createElement('meta')
    meta.name = name
    document.head.append(meta)
  }
  meta.content = content
}

function updateCanonical(path: string) {
  let link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (!link) {
    link = document.createElement('link')
    link.rel = 'canonical'
    document.head.append(link)
  }
  link.href = `https://pavelkayler.com${path}`
}

export function LegacyPage({ pageKey }: { pageKey: PageKey }) {
  const page = pages[pageKey]
  const html = useMemo(() => withBase(page.html), [page.html])
  const rootRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    document.title = page.title
    upsertMeta('description', page.description)
    updateCanonical(page.path)
    document.body.className = page.bodyClass
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [page, location.pathname])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const findInternalAnchor = (target: EventTarget | null) => {
      const element = target instanceof Element ? target : null
      const anchor = element?.closest<HTMLAnchorElement>('a[href]')
      if (!anchor || anchor.classList.contains('js-gallery-link')) return null
      const href = anchor.getAttribute('href') || ''
      return href.startsWith('/') ? { anchor, href } : null
    }

    const onClick = (event: MouseEvent) => {
      const internal = findInternalAnchor(event.target)
      if (!internal) return
      event.preventDefault()
      navigate(internal.href)
    }

    const onPrefetch = (event: Event) => {
      const internal = findInternalAnchor(event.target)
      if (internal) prefetchRoute(internal.href)
    }

    root.addEventListener('click', onClick)
    root.addEventListener('pointerover', onPrefetch)
    root.addEventListener('focusin', onPrefetch)
    root.addEventListener('pointerdown', onPrefetch)

    // Keep the original Wfolio colour/aspect placeholders visible immediately and only
    // fade the real bitmap in after the browser has decoded it. This removes the blank
    // flash that made first-time route changes feel blocked by image loading.
    root.querySelectorAll<HTMLImageElement>('.lazy-image img').forEach((image) => {
      const container = image.closest<HTMLElement>('.lazy-image')
      if (!container) return

      const reveal = () => {
        const markLoaded = () => container.classList.add('is-loaded')
        if (typeof image.decode === 'function') image.decode().catch(() => undefined).finally(markLoaded)
        else markLoaded()
      }

      if (image.complete && image.naturalWidth > 0) reveal()
      else {
        image.addEventListener('load', reveal, { once: true })
        image.addEventListener('error', () => container.classList.add('is-loaded'), { once: true })
      }
    })

    const lightboxes: PhotoSwipeLightbox[] = []
    root.querySelectorAll<HTMLElement>('.js-gallery').forEach((gallery) => {
      const lightbox = new PhotoSwipeLightbox({
        gallery,
        children: 'a.js-gallery-link',
        pswpModule: () => import('photoswipe'),
        bgOpacity: 0.96,
        preload: [1, 2],
        wheelToZoom: true,
        showHideAnimationType: 'fade',
      })
      lightbox.init()
      lightboxes.push(lightbox)
    })

    const masonryInstances: Masonry[] = []
    root.querySelectorAll<HTMLElement>('.album-masonry').forEach((container) => {
      const masonry = new Masonry(container, {
        itemSelector: '.piece',
        percentPosition: true,
        transitionDuration: 0,
      })
      masonryInstances.push(masonry)
      container.querySelectorAll('img').forEach((image) => {
        image.addEventListener('load', () => masonry.layout?.(), { once: true })
      })
      requestAnimationFrame(() => masonry.layout?.())
    })

    return () => {
      root.removeEventListener('click', onClick)
      root.removeEventListener('pointerover', onPrefetch)
      root.removeEventListener('focusin', onPrefetch)
      root.removeEventListener('pointerdown', onPrefetch)
      lightboxes.forEach((lightbox) => lightbox.destroy())
      masonryInstances.forEach((masonry) => masonry.destroy?.())
    }
  }, [html, navigate])

  return <div ref={rootRef} className="legacy-page react-route" dangerouslySetInnerHTML={{ __html: html }} />
}
