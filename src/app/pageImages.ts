import { imageIsPrepared, waitAbortable } from './imageResources'

export function renderedPageImages() {
  return [...document.querySelectorAll<HTMLImageElement>(
    '#root .react-route img, #root .persistent-site-logo img')]
}

// Fast path uses live retained decode handles AND the actual mounted image state.
// A task once marked ready is not by itself a guarantee of a painted page.
export function renderedPageIsReady() {
  const images = renderedPageImages()
  return images.length > 0 && images.every(image => image.complete && image.naturalWidth > 0 &&
    (imageIsPrepared(image.currentSrc || image.src) || image.dataset.decodedSrc === image.src))
}

export async function decodeRenderedPage(signal?: AbortSignal, retry = false) {
  const images = renderedPageImages()
  if (!document.querySelector('#root .react-route')) throw new Error('Page has not mounted')
  let timer: number | undefined
  const decode = Promise.all(images.map(async image => {
    image.loading = 'eager'
    const expected = image.src
    if (retry && image.complete && !image.naturalWidth) {
      image.removeAttribute('src')
      image.src = expected
    }
    await image.decode()
    if (!image.isConnected || image.src !== expected || !image.naturalWidth) {
      throw new Error('Page image changed during preparation')
    }
    image.dataset.decodedSrc = expected
    image.closest('[data-role="lazy-image"]')?.classList.add('is-loaded', 'is-prepared')
  })).then(async () => {
    await document.fonts.ready
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
  })
  try {
    const bounded = Promise.race([decode, new Promise<never>((_, reject) => {
      timer = window.setTimeout(() => reject(new Error('Page image preparation timed out')), 60000)
    })])
    await (signal ? waitAbortable(bounded, signal) : bounded)
  } finally { window.clearTimeout(timer) }
}
