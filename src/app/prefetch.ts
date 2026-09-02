import type { PageKey } from '../generated/pages'
import { albums, contactsContent, homeContent, worksContent } from '../generated/structured'

const routeToKey: Record<string, PageKey> = {
  '/': 'home',
  '/works': 'works',
  '/portraits': 'portraits',
  '/projects': 'projects',
  '/brands': 'brands',
  '/contacts': 'contacts',
}

interface ImageSpec {
  src: string
  srcset: string
  sizes: string
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

function withBase(value: string) {
  return value.replaceAll('__BASE__', import.meta.env.BASE_URL)
}

function structuredImageSpec(
  image: { src: string; srcSet: string },
  sizes: string,
): ImageSpec {
  return {
    src: withBase(image.src),
    srcset: withBase(image.srcSet),
    sizes,
  }
}

function routeImages(key: PageKey): ImageSpec[] {
  switch (key) {
    case 'home': {
      const slides = homeContent.cover.slides.map((image) => structuredImageSpec(image, '100vw'))
      const content = homeContent.pictureRows.flatMap((row) =>
        row.columns.map((column) => structuredImageSpec(
          column.image,
          row.columns.length > 1 ? '(max-width: 768px) 100vw, 50vw' : '100vw',
        )),
      )
      return [...slides, ...content]
    }

    case 'works':
      return worksContent.cards.map((card) => structuredImageSpec(card.image, '(max-width: 768px) 100vw, 33vw'))

    case 'portraits':
    case 'projects':
    case 'brands': {
      const album = albums[key]
      const result: ImageSpec[] = []
      if (album.cover?.poster) {
        result.push({ src: withBase(album.cover.poster), srcset: '', sizes: '100vw' })
      }
      result.push(...album.photos.map((photo) => structuredImageSpec(photo.image, '(max-width: 768px) 50vw, 33vw')))
      return result
    }

    case 'contacts':
      return [structuredImageSpec(contactsContent.image, '(max-width: 768px) 100vw, 33vw')]
  }
}

function warmImage(key: PageKey, imageSpec: ImageSpec, priority: 'high' | 'low') {
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

  // Intent makes the next viewport hot. Idle warming remains deliberately conservative
  // so a photo portfolio does not download every gallery in the background.
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

  routes.forEach((route, index) => {
    timers.push(window.setTimeout(() => prefetchRoute(route, 'idle'), 1200 + index * 650))
  })

  return () => timers.forEach((timer) => window.clearTimeout(timer))
}
