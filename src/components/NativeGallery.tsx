import { useEffect, useRef } from 'react'
import type { GalleryPhoto } from '../content/types'
import { resolveAsset, StructuredImage } from './StructuredImage'

export function NativeGallery({ photos }: { photos: GalleryPhoto[] | readonly GalleryPhoto[] }) {
  const galleryRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const gallery = galleryRef.current
    if (!gallery) return

    let masonry: { layout?: () => void; destroy?: () => void } | null = null
    let lightbox: { init: () => void; destroy: () => void } | null = null
    let observer: IntersectionObserver | null = null
    let frameA = 0
    let frameB = 0
    let initialized = false
    let cancelled = false

    const initialize = () => {
      if (initialized || cancelled) return
      initialized = true

      frameA = requestAnimationFrame(() => {
        frameB = requestAnimationFrame(async () => {
          if (!gallery.isConnected || cancelled) return

          const [{ default: Masonry }, { default: PhotoSwipeLightbox }] = await Promise.all([
            import('masonry-layout'),
            import('photoswipe/lightbox'),
          ])
          if (!gallery.isConnected || cancelled) return

          masonry = new Masonry(gallery, {
            itemSelector: '.piece',
            percentPosition: true,
            transitionDuration: 0,
          })
          masonry.layout?.()

          lightbox = new PhotoSwipeLightbox({
            gallery,
            children: 'a.js-gallery-link',
            pswpModule: () => import('photoswipe'),
            bgOpacity: 0.96,
            preload: [1, 2],
            wheelToZoom: true,
            showHideAnimationType: 'fade',
          })
          lightbox.init()
        })
      })
    }

    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            observer?.disconnect()
            initialize()
          }
        },
        { rootMargin: '1200px 0px' },
      )
      observer.observe(gallery)
    } else {
      initialize()
    }

    return () => {
      cancelled = true
      observer?.disconnect()
      cancelAnimationFrame(frameA)
      cancelAnimationFrame(frameB)
      lightbox?.destroy()
      masonry?.destroy?.()
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
                loading={index < 4 ? 'eager' : 'lazy'}
                fetchPriority={index < 2 ? 'high' : 'auto'}
              />
            </a>
          </div>
        </div>
      ))}
    </div>
  )
}
