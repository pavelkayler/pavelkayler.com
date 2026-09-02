import { useEffect, useRef } from 'react'
import type { StructuredImage as StructuredImageData } from '../generated/structured'

export function resolveAsset(value: string) {
  return value.replaceAll('__BASE__', import.meta.env.BASE_URL)
}

function resolveSrcSet(value: string) {
  return value.replaceAll('__BASE__', import.meta.env.BASE_URL)
}

interface Props {
  image: StructuredImageData
  sizes: string
  loading?: 'eager' | 'lazy'
  fetchPriority?: 'high' | 'low' | 'auto'
}

export function StructuredImage({ image, sizes, loading = 'lazy', fetchPriority = 'auto' }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)

  const reveal = () => {
    const node = imageRef.current
    const container = containerRef.current
    if (!node || !container) return
    const done = () => container.classList.add('is-loaded')
    if (typeof node.decode === 'function') node.decode().catch(() => undefined).finally(done)
    else done()
  }

  useEffect(() => {
    const node = imageRef.current
    if (node?.complete && node.naturalWidth > 0) reveal()
  }, [])

  return (
    <div
      ref={containerRef}
      className="lazy-image js-lazy-image"
      data-role="lazy-image"
      data-width={image.width}
      data-height={image.height}
      data-aspect={image.aspect}
    >
      <canvas
        className="placeholder"
        width={image.placeholderWidth}
        height={image.placeholderHeight}
        style={{ backgroundColor: image.placeholderColor }}
      />
      <img
        ref={imageRef}
        alt={image.alt}
        src={resolveAsset(image.src)}
        srcSet={image.srcSet ? resolveSrcSet(image.srcSet) : undefined}
        sizes={sizes}
        loading={loading}
        decoding="async"
        fetchPriority={fetchPriority}
        onLoad={reveal}
        onError={() => containerRef.current?.classList.add('is-loaded')}
      />
    </div>
  )
}
