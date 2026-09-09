import { ResourceQueue } from './resourceQueue'

export interface ImageSpec { src: string; srcSet?: string; sizes?: string }
export const resources = new ResourceQueue()
export const resolveAsset = (value: string) => value.replaceAll('__BASE__', import.meta.env.BASE_URL)

// Selection is shared by the queue AND rendered images, avoiding preloading one
// srcset candidate and then downloading another on route entry. The site's sizes
// use media queries followed by px/vw lengths; unsupported expressions fail early.
export function imageUrl(spec: ImageSpec) {
  const candidates = (spec.srcSet || '').split(',').flatMap(part => {
    const match = part.trim().match(/^(\S+)\s+(\d+)w$/)
    return match ? [{ url: resolveAsset(match[1]), width: Number(match[2]) }] : []
  }).sort((a, b) => a.width - b.width)
  if (!candidates.length) return resolveAsset(spec.src)
  let slot = window.innerWidth
  for (const size of (spec.sizes || '100vw').split(',')) {
    const match = size.trim().match(/^(?:(\(.+\))\s+)?([\d.]+)(vw|px)$/)
    if (!match) throw new Error(`Unsupported responsive image size: ${size}`)
    if (match[1] && !window.matchMedia(match[1]).matches) continue
    slot = Number(match[2]) * (match[3] === 'vw' ? window.innerWidth / 100 : 1)
    break
  }
  const pixels = slot * (window.devicePixelRatio || 1)
  return (candidates.find(candidate => candidate.width >= pixels) || candidates[candidates.length - 1]).url
}

let viewportRevision = 0
const viewportListeners = new Set<() => void>()
let resizeTimer: number | undefined
export const viewportSnapshot = () => viewportRevision
export function subscribeViewport(listener: () => void) {
  viewportListeners.add(listener)
  return () => { viewportListeners.delete(listener) }
}
window.addEventListener('resize', () => {
  window.clearTimeout(resizeTimer)
  resizeTimer = window.setTimeout(() => {
    viewportRevision += 1
    for (const listener of viewportListeners) listener()
  }, 120)
})

const decoded = new Set<string>()
const demands = new Map<string, { decode: boolean; image?: HTMLImageElement }>()
// Do not immediately discard the detached preload elements for the core pages.
// Keeping their native handles avoids losing the warmed Contacts/Home resources
// while speculative album transfers fill an ephemeral browser's image cache.
// This is bounded and never pins the complete albums or their zoom variants.
const coreImages = new Map<string, HTMLImageElement>()
function retainCoreImage(url: string, image: HTMLImageElement) {
  if (!/\/media\/images\/(home|navigation|contacts|branding)\//.test(url)) return
  coreImages.delete(url)
  coreImages.set(url, image)
  while (coreImages.size > 32) coreImages.delete(coreImages.keys().next().value!)
}
const canonicalResource = (value: string) => {
  const url = new URL(value, location.href)
  return url.origin === location.origin ? url.pathname + url.search : url.href
}
export const imageTaskId = (url: string) => `image:${canonicalResource(url)}`
export function imageIsPrepared(url: string) {
  return resources.get(imageTaskId(url))?.state === 'ready' && decoded.has(canonicalResource(url))
}
export const imageIsDownloaded = (url: string) => resources.get(imageTaskId(url))?.state === 'ready'

function transferImage(url: string, demand: { decode: boolean; image?: HTMLImageElement }, priority: number) {
  return new Promise<void>((resolve, reject) => {
    const image = new Image()
    demand.image = image
    image.decoding = 'async'
    image.fetchPriority = priority <= 10 ? 'high' : 'low'
    let done = false
    const finish = (error?: unknown) => {
      if (done) return
      done = true
      window.clearTimeout(timer)
      image.onload = image.onerror = null
      demand.image = undefined
      if (error) { image.removeAttribute('src'); reject(error) }
      else {
        if (demand.decode) retainCoreImage(url, image)
        resolve()
      }
    }
    // Timeout is a failure with recovery controls, never permission to hide the loader.
    const timer = window.setTimeout(() => finish(new Error(`Image timed out: ${url}`)), 60000)
    image.onerror = () => finish(new Error(`Image unavailable: ${url}`))
    image.onload = () => {
      if (!image.naturalWidth) return finish(new Error(`Empty image: ${url}`))
      if (!demand.decode) return finish()
      void image.decode().then(() => { decoded.add(url); finish() }, finish)
    }
    image.src = url
  })
}

export function requestImage(url: string, priority: number, decode = false, retry = false) {
  url = canonicalResource(url)
  let demand = demands.get(url)
  if (!demand) { demand = { decode }; demands.set(url, demand) }
  demand.decode ||= decode
  const current = demand
  return resources.request(imageTaskId(url), async () => {
    for (let attempt = 0; ; attempt += 1) {
      try { await transferImage(url, current, resources.get(imageTaskId(url))?.priority ?? priority); return }
      catch (error) {
        if (attempt >= 1 || !navigator.onLine) throw error
        await new Promise(resolve => window.setTimeout(resolve, 600))
      }
    }
  }, priority, {
    retry,
    refresh: decode && !decoded.has(url),
    promote: () => { if (current.image) current.image.fetchPriority = 'high' },
  })
}

export function requestVideo(url: string, priority: number, retry = false) {
  return resources.request(`video:${url}`, async () => {
    const controller = new AbortController()
    const timer = window.setTimeout(() => controller.abort(), 120000)
    try {
      const response = await fetch(url, { signal: controller.signal, cache: 'default' })
      if (!response.ok) throw new Error(`Video HTTP ${response.status}: ${url}`)
      // Consume without holding a video-sized Blob or ArrayBuffer in JS memory.
      const reader = response.body?.getReader()
      if (reader) { while (!(await reader.read()).done) { /* HTTP cache fill */ } }
    } finally { window.clearTimeout(timer) }
  }, priority, { retry })
}

export function waitAbortable<T>(promise: Promise<T>, signal: AbortSignal) {
  return new Promise<T>((resolve, reject) => {
    const aborted = () => reject(new DOMException('Navigation superseded', 'AbortError'))
    if (signal.aborted) return aborted()
    signal.addEventListener('abort', aborted, { once: true })
    void promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', aborted))
  })
}
