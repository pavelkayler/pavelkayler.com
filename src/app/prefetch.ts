import { pages, type PageKey } from '../generated/pages'

const routeToKey: Record<string, PageKey> = {
  '/': 'home',
  '/works': 'works',
  '/portraits': 'portraits',
  '/projects': 'projects',
  '/brands': 'brands',
  '/contacts': 'contacts',
}

const warmedCounts = new Map<PageKey, number>()
const warmers = new Map<PageKey, HTMLImageElement[]>()

function normalizePath(pathname: string) {
  const withoutQuery = pathname.split(/[?#]/, 1)[0] || '/'
  if (withoutQuery === '/') return '/'
  return withoutQuery.replace(/\/+$/, '')
}

function connectionIsConstrained() {
  const nav = navigator as Navigator & {
    connection?: { saveData?: boolean; effectiveType?: string }
  }
  const connection = nav.connection
  return Boolean(connection?.saveData || connection?.effectiveType === 'slow-2g' || connection?.effectiveType === '2g')
}

function routeImages(key: PageKey) {
  const base = import.meta.env.BASE_URL
  const html = pages[key].html.replaceAll('__BASE__', base)
  const documentFragment = new DOMParser().parseFromString(html, 'text/html')

  return [...documentFragment.querySelectorAll<HTMLImageElement>('img')]
    .map((image) => ({
      src: image.getAttribute('src') || '',
      srcset: image.getAttribute('srcset') || '',
      sizes: image.getAttribute('sizes') || '',
    }))
    .filter((image) => image.src || image.srcset)
}

function warmImage(key: PageKey, imageSpec: { src: string; srcset: string; sizes: string }, priority: 'high' | 'low') {
  const image = new Image()
  image.decoding = 'async'
  image.fetchPriority = priority
  if (imageSpec.sizes) image.sizes = imageSpec.sizes
  if (imageSpec.srcset) image.srcset = imageSpec.srcset
  if (imageSpec.src) image.src = imageSpec.src

  const bucket = warmers.get(key) ?? []
  bucket.push(image)
  warmers.set(key, bucket)

  const release = () => {
    const current = warmers.get(key)
    if (!current) return
    const index = current.indexOf(image)
    if (index >= 0) current.splice(index, 1)
    if (!current.length) warmers.delete(key)
  }
  image.addEventListener('load', release, { once: true })
  image.addEventListener('error', release, { once: true })
}

export function prefetchRoute(pathname: string, mode: 'intent' | 'idle' = 'intent') {
  const key = routeToKey[normalizePath(pathname)]
  if (!key) return
  if (mode === 'idle' && connectionIsConstrained()) return

  // Intent should make the next viewport effectively hot. Idle warming is deliberately
  // conservative so the portfolio does not download every gallery in the background.
  const desiredCount = mode === 'intent' ? 6 : 2
  const currentCount = warmedCounts.get(key) ?? 0
  if (currentCount >= desiredCount) return

  const images = routeImages(key)
  for (const imageSpec of images.slice(currentCount, desiredCount)) {
    warmImage(key, imageSpec, mode === 'intent' ? 'high' : 'low')
  }
  warmedCounts.set(key, Math.min(desiredCount, images.length))
}

const neighbors: Record<string, string[]> = {
  '/': ['/works', '/contacts'],
  '/works': ['/portraits', '/projects', '/brands'],
  '/portraits': ['/works', '/projects'],
  '/projects': ['/works', '/brands'],
  '/brands': ['/works', '/projects'],
  '/contacts': ['/works', '/'],
}

export function scheduleRouteWarmup(pathname: string) {
  if (connectionIsConstrained()) return () => undefined

  const routes = neighbors[normalizePath(pathname)] ?? []
  const timers: number[] = []

  // Let the current page claim the network first, then warm only two responsive images
  // from each likely destination. Hover/focus/pointerdown upgrades that route to six.
  routes.forEach((route, index) => {
    timers.push(window.setTimeout(() => prefetchRoute(route, 'idle'), 1200 + index * 650))
  })

  return () => timers.forEach((timer) => window.clearTimeout(timer))
}
