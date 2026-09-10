/** First-paint check only. Off-screen/lazy images must not block site entry. */
export function firstScreenImages() {
  return [...document.querySelectorAll<HTMLImageElement>('#root .react-route img, #root .persistent-site-logo img')]
    .filter(image => {
      if (image.closest('[aria-hidden="true"]')) return false
      const rect = image.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight &&
        rect.right > 0 && rect.left < window.innerWidth
    })
}
const frames = () => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
export async function decodeRenderedPage(_signal?: AbortSignal, retry = false) {
  await document.fonts.ready
  await frames()
  const images = firstScreenImages()
  await Promise.all(images.map(async image => {
    image.loading = 'eager'
    if (retry && image.complete && !image.naturalWidth) {
      const src = image.src
      image.removeAttribute('src')
      image.src = src
    }
    await image.decode()
    if (!image.naturalWidth) throw new Error(`First-screen image unavailable: ${image.src}`)
    image.closest('[data-role="lazy-image"]')?.classList.add('is-loaded', 'is-prepared')
  }))
  await frames()
}
