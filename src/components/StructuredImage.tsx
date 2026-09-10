import { useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { StructuredImage as StructuredImageData } from '../content/types'
import { imageIsPrepared, imageUrl, resources, subscribeViewport, viewportSnapshot } from '../app/imageResources'
import { getInitialPhase, subscribeInitialPhase } from '../app/siteLoading'
import { observeAhead } from '../app/aheadLoading'
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
  const [displayedSrc, setDisplayedSrc] = useState('')
  const [near, setNear] = useState(false)
  const [failedSrc, setFailedSrc] = useState('')
  const phase = useSyncExternalStore(subscribeInitialPhase, getInitialPhase)
  const viewport = useSyncExternalStore(subscribeViewport, viewportSnapshot)
  useSyncExternalStore(resources.subscribe, resources.getRevision)
  const src = imageUrl({ ...image, sizes })
  const prepared = imageIsPrepared(src) && failedSrc !== src
  const shown = prepared || displayedSrc === src
  const reveal = () => {
    const node = imageRef.current
    if (!node) return
    const expected = node.src
    void node.decode().then(() => {
      if (imageRef.current !== node || node.src !== expected || !node.naturalWidth) return
      containerRef.current?.classList.add('is-loaded', 'is-prepared')
      setFailedSrc('')
      setDisplayedSrc(src)
    }).catch(() => undefined)
  }
  useLayoutEffect(() => {
    const node = imageRef.current
    if (node?.complete && node.naturalWidth > 0) reveal()
  }, [src, prepared])
  useLayoutEffect(() => {
    const element = containerRef.current
    if (!element || loading === 'eager' || near) return
    // Unlocking the startup mask can turn BODY into the real mobile scrollport.
    return observeAhead(element, () => setNear(true))
  }, [loading, near, phase, viewport])
  return (
    <div ref={containerRef} className={`lazy-image js-lazy-image${shown ? ' is-loaded is-prepared' : ''}`}
      data-role="lazy-image" data-width={image.width} data-height={image.height} data-aspect={image.aspect}
      data-ahead={near ? 'ready' : undefined} data-image-error={failedSrc === src ? 'true' : undefined}>
      <canvas className="placeholder" width={image.placeholderWidth} height={image.placeholderHeight}
        style={{ backgroundColor: image.placeholderColor }} />
      <img ref={imageRef} alt={image.alt} src={src} sizes={sizes} width={image.width} height={image.height}
        loading={shown || near ? 'eager' : loading} decoding="async" fetchPriority={fetchPriority} onLoad={reveal}
        onError={() => { setFailedSrc(src); setDisplayedSrc('') }} />
    </div>
  )
