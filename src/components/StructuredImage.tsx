import { useLayoutEffect, useRef, useSyncExternalStore } from 'react'
import type { StructuredImage as StructuredImageData } from '../content/types'
import { imageIsDownloaded, imageIsPrepared, imageUrl, resources,
  subscribeViewport, viewportSnapshot } from '../app/imageResources'
export { resolveAsset } from '../app/imageResources'

interface Props {
  image: StructuredImageData
  sizes: string
  loading?: 'eager' | 'lazy'
  fetchPriority?: 'high' | 'low' | 'auto'
}
export function StructuredImage({ image, sizes, loading = 'lazy', fetchPriority = 'auto' }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  useSyncExternalStore(subscribeViewport, viewportSnapshot)
  useSyncExternalStore(resources.subscribe, resources.getRevision)
  const src = imageUrl({ ...image, sizes })
  const prepared = imageIsPrepared(src)

  const reveal = () => {
    const node = imageRef.current
    const container = containerRef.current
    if (!node || !container) return
    const expected = node.src
    void node.decode().then(() => {
      if (imageRef.current === node && node.src === expected) container.classList.add('is-loaded')
    }).catch(() => undefined)
  }
  useLayoutEffect(() => {
    const node = imageRef.current
    if (node?.complete && node.naturalWidth > 0) reveal()
    else if (node?.complete && prepared) node.src = src
  }, [src, prepared])

  return (
    <div ref={containerRef} className={`lazy-image js-lazy-image${prepared ? ' is-loaded is-prepared' : ''}`}
      data-role="lazy-image" data-width={image.width} data-height={image.height} data-aspect={image.aspect}>
      <canvas className="placeholder" width={image.placeholderWidth} height={image.placeholderHeight}
        style={{ backgroundColor: image.placeholderColor }} />
      <img ref={imageRef} alt={image.alt} src={src} sizes={sizes}
        width={image.width} height={image.height}
        loading={prepared || imageIsDownloaded(src) ? 'eager' : loading}
        decoding="async" fetchPriority={fetchPriority} onLoad={reveal}
        onError={() => containerRef.current?.classList.add('is-loaded')} />
    </div>
  )
}
