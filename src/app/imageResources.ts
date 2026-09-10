import { ResourceQueue } from './resourceQueue'
export interface ImageSpec { src: string; srcSet?: string; sizes?: string }
export const resources = new ResourceQueue()
export const resolveAsset = (value: string) => value.replaceAll('__BASE__', import.meta.env.BASE_URL)
const canonical = (value: string) => {
  const url = new URL(value, location.href)
  return url.origin === location.origin ? url.pathname + url.search : url.href
}
interface ResidentImage { image: HTMLImageElement; decoded: boolean }
// A small cache for first-screen/slider preloads, not the entire media library.
const residents = new Map<string, ResidentImage>()
const MAX_RETAINED_IMAGES = 32
function widthFromFilename(value: string) {
  const clean = value.split(/[?#]/, 1)[0]
  const match = clean.match(/-(\d+)x\d+\.[A-Za-z0-9]+$/)
  return match ? Number(match[1]) : 0
}
export function imageCandidates(spec: ImageSpec) {
  return (spec.srcSet || '').split(',').flatMap(part => {
    const match = part.trim().match(/^(\S+)\s+(\d+)w$/)
    if (!match) return []
    const url = resolveAsset(match[1])
    // The imported Wfolio descriptors were historically rounded to layout widths
    // (600/1240/1880w), while the actual files are 640/1280/1920px. Prefer the real
    // pixel width encoded in maintained filenames so a 640px preview is not skipped.
    const width = widthFromFilename(url) || Number(match[2])
    return [{ url, width }]
  }).sort((a, b) => a.width - b.width)
}
export function imageUrl(spec: ImageSpec) {
  const candidates = imageCandidates(spec)
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
  return (candidates.find(item => item.width >= pixels) || candidates[candidates.length - 1]).url
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
export const imageTaskId = (url: string) => `image:${canonical(url)}`
export const imageIsDownloaded = (url: string) => residents.has(canonical(url))
export function imageIsPrepared(url: string) {
  const record = residents.get(canonical(url))
  return Boolean(record?.decoded && record.image.complete && record.image.naturalWidth > 0)
}
const demands = new Map<string, { decode: boolean; image?: HTMLImageElement }>()
function transferImage(url: string, demand: { decode: boolean; image?: HTMLImageElement }, priority: number) {
  return new Promise<void>((resolve, reject) => {
    const image = new Image()
    demand.image = image
    image.decoding = 'async'
    image.fetchPriority = priority <= 1 ? 'high' : 'low'
    let done = false
    const finish = (error?: unknown) => {
      if (done) return
      done = true
      window.clearTimeout(timer)
      image.onload = image.onerror = null
      demand.image = undefined
      if (error) { image.removeAttribute('src'); reject(error) }
      else {
        residents.delete(url)
        residents.set(url, { image, decoded: demand.decode })
        while (residents.size > MAX_RETAINED_IMAGES) residents.delete(residents.keys().next().value!)
        resolve()
      }
    }
    const timer = window.setTimeout(() => finish(new Error(`Image timed out: ${url}`)), 30000)
    image.onerror = () => finish(new Error(`Image unavailable: ${url}`))
    image.onload = () => {
      if (!image.naturalWidth) return finish(new Error(`Empty image: ${url}`))
      if (!demand.decode) return finish()
      void image.decode().then(() => finish(), finish)
    }
    image.src = url
  })
}
export function requestImage(url: string, priority: number, decode = false, retry = false) {
  url = canonical(url)
  let demand = demands.get(url)
  if (!demand) { demand = { decode }; demands.set(url, demand) }
  demand.decode ||= decode
  const current = demand
  return resources.request(imageTaskId(url), async () => {
    for (let attempt = 0; ; attempt += 1) {
      try {
        const resident = residents.get(url)
        if (resident) {
          if (current.decode && !resident.decoded) { await resident.image.decode(); resident.decoded = true }
          residents.delete(url); residents.set(url, resident)
        } else { await transferImage(url, current, resources.get(imageTaskId(url))?.priority ?? priority) }
        return
      } catch (error) {
        if (attempt >= 1 || !navigator.onLine) throw error
        await new Promise(resolve => window.setTimeout(resolve, 600))
      }
    }
  }, priority, {
    retry, refresh: !imageIsDownloaded(url) || (decode && !imageIsPrepared(url)),
    promote: () => { if (current.image) current.image.fetchPriority = 'high' },
  })
}
