import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { requestImage } from '../app/imageResources'
import Masonry from 'masonry-layout'
import type { GalleryPhoto } from '../content/types'
import { resolveAsset, StructuredImage } from './StructuredImage'

interface Props {
  photos: GalleryPhoto[] | readonly GalleryPhoto[]
  prioritizeFirst?: boolean
}

type LightboxInstance = {
  init: () => void
  destroy: () => void
  loadAndOpen: (index: number) => boolean
}

type IdleWindow = Window & typeof globalThis & {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number
  cancelIdleCallback?: (id: number) => void
}

const INITIAL_ITEMS = 12
const BATCH_ITEMS = 12

export function NativeGallery({ photos, prioritizeFirst = true }: Props) {
  const galleryRef = useRef<HTMLDivElement>(null)
  const masonryRef = useRef<Masonry | null>(null)
  const laidOutCountRef = useRef(Math.min(INITIAL_ITEMS, photos.length))
  const [visibleCount, setVisibleCount] = useState(() => Math.min(INITIAL_ITEMS, photos.length))
  const visiblePhotos = photos.slice(0, visibleCount)

  // Only the first small batch participates in the blocking pre-paint layout. Long
  // albums are appended afterwards, so entering the route never lays out 40-50 items
  // before the browser can show its first frame.
  useLayoutEffect(() => {
    const gallery = galleryRef.current
    if (!gallery) return

    laidOutCountRef.current = Math.min(INITIAL_ITEMS, photos.length)
    const masonry = new Masonry(gallery, {
      itemSelector: '.piece',
      percentPosition: true,
      transitionDuration: 0,
    })
    masonryRef.current = masonry
    masonry.layout?.()

    return () => {
      masonry.destroy?.()
      if (masonryRef.current === masonry) masonryRef.current = null
    }
  }, [photos])

  // Give the destination route a generous quiet window before adding below-fold DOM.
  // Subsequent batches are scheduled only when the main thread becomes idle.
  useEffect(() => {
    if (visibleCount >= photos.length) return
    const idleWindow = window as IdleWindow
    let idleId: number | undefined
    const delay = visibleCount <= INITIAL_ITEMS ? 600 : 80
    const timer = window.setTimeout(() => {
      const append = () => setVisibleCount(current => Math.min(current + BATCH_ITEMS, photos.length))
      if (idleWindow.requestIdleCallback) idleId = idleWindow.requestIdleCallback(append, { timeout: 450 })
      else append()
    }, delay)
    return () => {
      window.clearTimeout(timer)
      if (idleId !== undefined) idleWindow.cancelIdleCallback?.(idleId)
    }
  }, [visibleCount, photos.length])

  // Position only the nodes React just appended. Masonry's appended() preserves the
  // already-laid-out items, avoiding repeated full-gallery measurement/layout passes.
  useLayoutEffect(() => {
    const masonry = masonryRef.current
    const gallery = galleryRef.current
    if (!masonry || !gallery || visibleCount <= laidOutCountRef.current) return
    const pieces = Array.from(gallery.querySelectorAll<HTMLElement>('.piece'))
    const added = pieces.slice(laidOutCountRef.current, visibleCount)
    if (added.length) masonry.appended?.(added)
    laidOutCountRef.current = visibleCount
  }, [visibleCount])

  useEffect(() => {
    const gallery = galleryRef.current
    if (!gallery) return

    let lightbox: LightboxInstance | null = null
    let initialization: Promise<LightboxInstance | null> | null = null
    let cancelled = false

    const ensureLightbox = () => {
      if (lightbox) return Promise.resolve(lightbox)
      if (initialization) return initialization

      initialization = import('photoswipe/lightbox').then(({ default: PhotoSwipeLightbox }) => {
        if (!gallery.isConnected || cancelled) return null

        const instance = new PhotoSwipeLightbox({
          gallery,
          children: 'a.js-gallery-link',
          pswpModule: () => import('photoswipe'),
          bgOpacity: 0.96,
          preload: [1, 2],
          wheelToZoom: true,
          showHideAnimationType: 'fade',
        }) as LightboxInstance

        instance.init()
        lightbox = instance
        return instance
      })

      return initialization
    }

    const handleIntent = (event: Event) => {
      const target = event.target
      if (!(target instanceof Element) || !target.closest('a.js-gallery-link')) return
      void ensureLightbox().catch(() => undefined)
    }

    // If the first click arrives before the dynamic module has loaded, keep the user
    // on the gallery and open the selected photograph as soon as PhotoSwipe is ready.
    const handleEarlyClick = (event: MouseEvent) => {
      if (cancelled || event.defaultPrevented || event.button !== 0 ||
          event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return

      const target = event.target
      if (!(target instanceof Element)) return

      const anchor = target.closest('a.js-gallery-link')
      if (!(anchor instanceof HTMLAnchorElement) || !gallery.contains(anchor)) return

      void requestImage(anchor.href, 0).catch(() => undefined)
      if (lightbox) return
      event.preventDefault()
      event.stopPropagation()

      const links = Array.from(gallery.querySelectorAll<HTMLAnchorElement>('a.js-gallery-link'))
      const index = links.indexOf(anchor)
      if (index < 0) return

      void ensureLightbox().then((instance) => {
        if (!cancelled) instance?.loadAndOpen(index)
      }).catch(() => { if (!cancelled && anchor.isConnected) window.location.assign(anchor.href) })
    }

    gallery.addEventListener('pointerover', handleIntent, { passive: true })
    gallery.addEventListener('focusin', handleIntent)
    gallery.addEventListener('click', handleEarlyClick, true)

    return () => {
      cancelled = true
      gallery.removeEventListener('pointerover', handleIntent)
      gallery.removeEventListener('focusin', handleIntent)
      gallery.removeEventListener('click', handleEarlyClick, true)
      lightbox?.destroy()
    }
  }, [photos])

  return (
    <div
      ref={galleryRef}
      className="album-grid js-album-grid album-masonry js-album-masonry js-gallery"
      data-gallery-initial-zoom="true"
      data-mounted-count={visiblePhotos.length}
      data-total-count={photos.length}
    >
      {visiblePhotos.map((photo, index) => (
        <div
          className="piece -photo"
          data-aspect={photo.aspect}
          data-type="photo"
          id={photo.id}
          key={photo.id}
        >
          <div className="inner">
            <a
              className="link js-gallery-link"
              href={resolveAsset(photo.fullscreenSrc)}
              data-pswp-width={photo.fullscreenWidth}
              data-pswp-height={photo.fullscreenHeight}
              data-gallery-piece-id={photo.id.replace(/^piece-/, '')}
            >
              <StructuredImage
                image={photo.image}
                sizes="(max-width: 768px) 50vw, 33vw"
                loading={prioritizeFirst && index < 2 ? 'eager' : 'lazy'}
                fetchPriority={prioritizeFirst && index === 0 ? 'high' : 'auto'}
              />
            </a>
          </div>
        </div>
      ))}
    </div>
  )
}
