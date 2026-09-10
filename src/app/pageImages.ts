import { imageIsPrepared, waitAbortable } from './imageResources'

export function renderedPageImages() {
  return [...document.querySelectorAll<HTMLImageElement>(
    '#root .react-route img, #root .persistent-site-logo img')]
}

export function renderedPageIsReady() {
  const images = renderedPageImages()
  return images.length > 0 && images.every(image => image.complete && image.naturalWidth > 0 &&
    (imageIsPrepared(image.currentSrc || image.src) || image.dataset.decodedSrc === image.src))
}

const paintFrames = () => new Promise<void>(resolve =>
  requestAnimationFrame(() => requestAnimationFrame(() => resolve())))

export async function decodeRenderedPage(signal?: AbortSignal, retry = false) {
  let timer: number | undefined
  const settle = async () => {
    // A view-transition commit can replace the previous route's nodes after the
    // layout notification. Inspect the final mounted route, not an obsolete snapshot.
    for (;;) {
      if (signal?.aborted) throw new DOMException('Page superseded', 'AbortError')
      await paintFrames()
      if (!document.querySelector('#root .react-route')) throw new Error('Page has not mounted')
      const images = renderedPageImages()
      const sources = images.map(image => image.src)
      const results = await Promise.allSettled(images.map(async (image, index) => {
        image.loading = 'eager'
        if (retry && image.complete && !image.naturalWidth) {
          image.removeAttribute('src')
          image.src = sources[index]
        }
        await image.decode()
      }))
      if (signal?.aborted) throw new DOMException('Page superseded', 'AbortError')
      const current = renderedPageImages()
      if (images.length !== current.length || images.some((image, index) =>
        !image.isConnected || image !== current[index] || image.src !== sources[index])) continue
      const failure = results.findIndex((result, index) => result.status === 'rejected' || !images[index].naturalWidth)
      if (failure >= 0) {
        const outcome = results[failure]
        const reason = outcome.status === 'rejected' ? String(outcome.reason) : 'Empty image'
        throw new Error(`${sources[failure]}: ${reason}`)
      }
      for (const image of images) {
        image.dataset.decodedSrc = image.src
        image.closest('[data-role="lazy-image"]')?.classList.add('is-loaded', 'is-prepared')
      }
      await document.fonts.ready
      await paintFrames()
      return
    }
  }
  try {
    const bounded = Promise.race([settle(), new Promise<never>((_, reject) => {
      timer = window.setTimeout(() => reject(new Error('Page image preparation timed out')), 60000)
    })])
    await (signal ? waitAbortable(bounded, signal) : bounded)
  } finally { window.clearTimeout(timer) }
}
