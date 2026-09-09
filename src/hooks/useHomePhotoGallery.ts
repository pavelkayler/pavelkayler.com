import { useEffect, useRef } from 'react'

type LightboxInstance = {
  init: () => void
  destroy: () => void
  loadAndOpen: (index: number) => boolean
}

const PHOTO_SELECTOR = 'a.home-gallery-link'

/** Bind only the homepage's standalone photographs, not category/navigation cards. */
export function useHomePhotoGallery() {
  const galleryRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const gallery = galleryRef.current
    if (!gallery) return

    let lightbox: LightboxInstance | null = null
    let initialization: Promise<LightboxInstance | null> | null = null
    let cancelled = false
    let latestClick = 0

    const ensureLightbox = () => {
      if (lightbox) return Promise.resolve(lightbox)
      if (initialization) return initialization

      // Neither module is downloaded merely to display the homepage. Load both on
      // first intent so a failed import can fall back to the actual image link.
      initialization = Promise.all([
        import('photoswipe/lightbox'),
        import('photoswipe'),
      ]).then(([{ default: PhotoSwipeLightbox }, { default: PhotoSwipe }]) => {
        if (cancelled || !gallery.isConnected) return null
        const instance = new PhotoSwipeLightbox({
          gallery,
          children: PHOTO_SELECTOR,
          pswpModule: PhotoSwipe,
          bgOpacity: 0.96,
          preload: [1, 2],
          wheelToZoom: true,
          showHideAnimationType: 'fade',
        }) as LightboxInstance
        instance.init()
        lightbox = instance
        return instance
      }).catch((error: unknown) => {
        initialization = null
        throw error
      })
      return initialization
    }

    const handleFirstClick = (event: MouseEvent) => {
      // Once ready, PhotoSwipe's native delegated click handler takes over.
      if (lightbox || cancelled || event.defaultPrevented || event.button !== 0 ||
          event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      if (!(event.target instanceof Element)) return
      const anchor = event.target.closest(PHOTO_SELECTOR)
      if (!(anchor instanceof HTMLAnchorElement) || !gallery.contains(anchor)) return
      const links = Array.from(gallery.querySelectorAll<HTMLAnchorElement>(PHOTO_SELECTOR))
      const index = links.indexOf(anchor)
      if (index < 0) return

      event.preventDefault()
      event.stopPropagation()
      const click = ++latestClick
      void ensureLightbox().then((instance) => {
        if (!cancelled && click === latestClick) instance?.loadAndOpen(index)
      }).catch(() => {
        // Keep a usable, same-origin image fallback if the JS chunks cannot load.
        if (!cancelled && click === latestClick && anchor.isConnected) {
          window.location.assign(anchor.href)
        }
      })
    }

    gallery.addEventListener('click', handleFirstClick, true)
    return () => {
      cancelled = true
      latestClick += 1
      gallery.removeEventListener('click', handleFirstClick, true)
      lightbox?.destroy()
    }
  }, [])

  return galleryRef
}
