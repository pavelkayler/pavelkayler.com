const ROUTE_SELECTOR = '#root .react-route'
const MAX_TOTAL_WAIT_MS = 4500
const MIN_VISIBLE_AFTER_BOOT_MS = 220
const LOADER_FADE_MS = 360

function wait(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms))
}

function waitForRouteRoot() {
  if (document.querySelector(ROUTE_SELECTOR)) return Promise.resolve()

  return new Promise<void>((resolve) => {
    const observer = new MutationObserver(() => {
      if (!document.querySelector(ROUTE_SELECTOR)) return
      observer.disconnect()
      resolve()
    })
    observer.observe(document.getElementById('root') ?? document.body, { childList: true, subtree: true })
  })
}

async function waitForImage(image: HTMLImageElement) {
  if (!image.complete) {
    await new Promise<void>((resolve) => {
      const done = () => resolve()
      image.addEventListener('load', done, { once: true })
      image.addEventListener('error', done, { once: true })
    })
  }

  if (image.naturalWidth > 0 && typeof image.decode === 'function') {
    await image.decode().catch(() => undefined)
  }
}

function waitForImageUrl(src: string) {
  const image = new Image()
  image.decoding = 'async'
  image.src = src
  return waitForImage(image)
}

async function waitForCriticalVisuals() {
  await waitForRouteRoot()

  const images = Array.from(
    document.querySelectorAll<HTMLImageElement>(
      '#root img[fetchpriority="high"], #root .persistent-site-logo img',
    ),
  )

  const coverVideo = document.querySelector<HTMLVideoElement>('#root .react-route video[poster]')
  const posterReady = coverVideo?.poster ? waitForImageUrl(coverVideo.poster) : null

  // On cover-less routes the first route image is part of the initial viewport. Album
  // routes with a video cover wait for the poster instead, not for gallery photos below it.
  if (!posterReady) {
    const firstRouteImage = document.querySelector<HTMLImageElement>('#root .react-route img')
    if (firstRouteImage && !images.includes(firstRouteImage)) images.push(firstRouteImage)
  }

  const fontsReady = document.fonts.ready.then(() => undefined).catch(() => undefined)
  await Promise.all([
    fontsReady,
    ...images.map(waitForImage),
    ...(posterReady ? [posterReady] : []),
  ])
}

export async function dismissInitialLoader() {
  const loader = document.getElementById('site-loader')
  if (!loader) {
    document.documentElement.removeAttribute('data-site-loading')
    return
  }

  const startedAt = performance.now()
  await Promise.race([waitForCriticalVisuals(), wait(MAX_TOTAL_WAIT_MS)])

  const remaining = MIN_VISIBLE_AFTER_BOOT_MS - (performance.now() - startedAt)
  if (remaining > 0) await wait(remaining)

  document.documentElement.removeAttribute('data-site-loading')
  loader.classList.add('is-hidden')
  window.setTimeout(() => loader.remove(), LOADER_FADE_MS + 80)
}
