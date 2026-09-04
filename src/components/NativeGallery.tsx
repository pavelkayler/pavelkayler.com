import { useEffect, useLayoutEffect, useRef } from 'react'
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

export function NativeGallery({ photos, prioritizeFirst = true }: Props) {
  const galleryRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const gallery = galleryRef.current
    if (!gallery) return

    const masonry = new Masonry(gallery, {
      itemSelector: '.piece',
      percentPosition: true,
      transitionDuration: 0,
    })
    masonry.layout?.()

    return () => masonry.destroy?.()
  }, [photos])

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

    // A gallery route is already an explicit user intent to browse photographs, so
    // initialize its small lightbox controller immediately. The previous viewport
    // observer could miss an absolutely-positioned Masonry container and leave every
    // photo as a plain link with no PhotoSwipe handler attached.
    void ensureLightbox()

    // Also cover the short interval while the dynamic module is downloading. If the
    // first tap arrives before init() completes, keep the browser on the gallery and
    // open that exact photograph as soon as PhotoSwipe is ready.
    const handleEarlyClick = (event: MouseEvent) => {
      if (lightbox || cancelled) return

      const target = event.target
      if (!(target instanceof Element)) return

      const anchor = target.closest('a.js-gallery-link')
      if (!(anchor instanceof HTMLAnchorElement) || !gallery.contains(anchor)) return

      event.preventDefault()
      event.stopPropagation()

      const links = Array.from(gallery.querySelectorAll<HTMLAnchorElement>('a.js-gallery-link'))
      const index = links.indexOf(anchor)
      if (index < 0) return

      void ensureLightbox().then((instance) => {
        if (!cancelled) instance?.loadAndOpen(index)
      })
    }

    gallery.addEventListener('click', handleEarlyClick, true)

    return () => {
      cancelled = true
      gallery.removeEventListener('click', handleEarlyClick, true)
      lightbox?.destroy()
    }
  }, [photos])

  return (
    <div
      ref={galleryRef}
      className="album-grid js-album-grid album-masonry js-album-masonry js-gallery"
      data-gallery-initial-zoom="true"
    >
      {photos.map((photo, index) => (
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
