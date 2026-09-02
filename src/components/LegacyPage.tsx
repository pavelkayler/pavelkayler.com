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

function afterFirstPaint(callback: () => void) {
  let secondFrame = 0
  const firstFrame = requestAnimationFrame(() => {
    secondFrame = requestAnimationFrame(callback)
  })

  return () => {
    cancelAnimationFrame(firstFrame)
    if (secondFrame) cancelAnimationFrame(secondFrame)
  }
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

    // One delegated listener replaces two listeners per image. Large portfolio routes can
    // contain hundreds of images, so this removes a sizeable amount of synchronous work
    // from the first route commit while keeping the instant Wfolio colour placeholders.
    const revealImage = (image: HTMLImageElement) => {
      const container = image.closest<HTMLElement>('.lazy-image')
      if (!container || container.classList.contains('is-loaded')) return

      const markLoaded = () => container.classList.add('is-loaded')
      if (typeof image.decode === 'function') image.decode().catch(() => undefined).finally(markLoaded)
      else markLoaded()
    }

    const onImageLoad = (event: Event) => {
      if (event.target instanceof HTMLImageElement && event.target.matches('.lazy-image img')) {
        revealImage(event.target)
      }
    }

    const onImageError = (event: Event) => {
      if (!(event.target instanceof HTMLImageElement) || !event.target.matches('.lazy-image img')) return
      event.target.closest<HTMLElement>('.lazy-image')?.classList.add('is-loaded')
    }

    root.addEventListener('load', onImageLoad, true)
    root.addEventListener('error', onImageError, true)

    // Cached images may finish before React effects are attached. Only those need an
    // immediate pass; uncached images are handled by the delegated listener above.
    root.querySelectorAll<HTMLImageElement>('.lazy-image img').forEach((image) => {
      if (image.complete && image.naturalWidth > 0) revealImage(image)
    })

    const lightboxes: PhotoSwipeLightbox[] = []
    const cancelLightboxInit = afterFirstPaint(() => {
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
    })

    // Masonry used to initialise every gallery synchronously and run layout again for
    // every image load. Wfolio placeholders already preserve the final image geometry,
    // so one layout is sufficient. Below-the-fold galleries are initialised only when
    // they approach the viewport, keeping route transitions responsive.
    const masonryInstances = new Map<HTMLElement, Masonry>()
    const pendingMasonryFrames = new Set<number>()

    const initMasonry = (container: HTMLElement) => {
      if (masonryInstances.has(container) || !container.isConnected) return

      const frame = requestAnimationFrame(() => {
        pendingMasonryFrames.delete(frame)
        if (!container.isConnected || masonryInstances.has(container)) return

        const masonry = new Masonry(container, {
          itemSelector: '.piece',
          percentPosition: true,
          transitionDuration: 0,
        })
        masonryInstances.set(container, masonry)
        masonry.layout?.()
      })
      pendingMasonryFrames.add(frame)
    }

    const masonryContainers = Array.from(root.querySelectorAll<HTMLElement>('.album-masonry'))
    let masonryObserver: IntersectionObserver | null = null

    if ('IntersectionObserver' in window) {
      masonryObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          const container = entry.target as HTMLElement
          masonryObserver?.unobserve(container)
          initMasonry(container)
        })
      }, {
        rootMargin: '1200px 0px',
        threshold: 0,
      })

      masonryContainers.forEach((container) => masonryObserver?.observe(container))
    } else {
      const cancelFallbackMasonryInit = afterFirstPaint(() => {
        masonryContainers.forEach(initMasonry)
      })

      return () => {
        cancelFallbackMasonryInit()
        root.removeEventListener('click', onClick)
        root.removeEventListener('pointerover', onPrefetch)
        root.removeEventListener('focusin', onPrefetch)
        root.removeEventListener('pointerdown', onPrefetch)
        root.removeEventListener('load', onImageLoad, true)
        root.removeEventListener('error', onImageError, true)
        cancelLightboxInit()
        lightboxes.forEach((lightbox) => lightbox.destroy())
        pendingMasonryFrames.forEach(cancelAnimationFrame)
        masonryInstances.forEach((masonry) => masonry.destroy?.())
      }
    }

    return () => {
      root.removeEventListener('click', onClick)
      root.removeEventListener('pointerover', onPrefetch)
      root.removeEventListener('focusin', onPrefetch)
      root.removeEventListener('pointerdown', onPrefetch)
      root.removeEventListener('load', onImageLoad, true)
      root.removeEventListener('error', onImageError, true)
      cancelLightboxInit()
      lightboxes.forEach((lightbox) => lightbox.destroy())
      masonryObserver?.disconnect()
      pendingMasonryFrames.forEach(cancelAnimationFrame)
      masonryInstances.forEach((masonry) => masonry.destroy?.())
    }
  }, [html, navigate])

  return <div ref={rootRef} className="legacy-page react-route" dangerouslySetInnerHTML={{ __html: html }} />
}
