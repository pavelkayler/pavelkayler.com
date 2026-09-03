import type { PageKey } from '../generated/pages'
import { routePrefetch, type PrefetchImageSpec } from '../generated/content/prefetch'
import { preloadRouteModule } from './routeModules'

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
  const nav = navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }
  const connection = nav.connection
  return Boolean(connection?.saveData || connection?.effectiveType === 'slow-2g' || connection?.effectiveType === '2g')
}

function withBase(value: string) {
  return value.replaceAll('__BASE__', import.meta.env.BASE_URL)
}

function warmImage(key: PageKey, imageSpec: PrefetchImageSpec) {
  const image = new Image()
  image.decoding = 'async'
  image.fetchPriority = 'high'
  if (imageSpec.sizes) image.sizes = imageSpec.sizes
  if (imageSpec.srcSet) image.srcset = withBase(imageSpec.srcSet)
  if (imageSpec.src) image.src = withBase(imageSpec.src)

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
  const normalized = normalizePath(pathname)
  const key = routeToKey[normalized]
  if (!key) return
  if (mode === 'idle' && connectionIsConstrained()) return

  // Route JS/data can be warmed in idle time without forcing large photography assets
  // onto the network. Images are prefetched only after explicit navigation intent.
  void preloadRouteModule(normalized)
  if (mode === 'idle') return

  const desiredCount = 6
  const currentCount = warmedCounts.get(key) ?? 0
  if (currentCount >= desiredCount) return

  const images = routePrefetch[key] ?? []
  for (const imageSpec of images.slice(currentCount, desiredCount)) {
    warmImage(key, imageSpec)
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

  routes.forEach((route, index) => {
    timers.push(window.setTimeout(() => prefetchRoute(route, 'idle'), 1200 + index * 650))
  })

  return () => timers.forEach((timer) => window.clearTimeout(timer))
}
