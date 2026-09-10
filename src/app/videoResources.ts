import { resources, resolveAsset } from './imageResources'
const CACHE_NAME = 'portfolio-video-v1'
const release = new URL('.', import.meta.url).pathname
interface VideoRecord { element: HTMLVideoElement; bytes: number; method: string }
const players = new Map<string, VideoRecord>()
const key = (value: string) => new URL(resolveAsset(value), location.href).href
export const preparedVideo = (value: string) => players.get(key(value))?.element
let control: Promise<void> | undefined
let host: HTMLDivElement | undefined
export function prepareVideoCache(): Promise<void> {
  if (!control) {
    let timer: number | undefined
    const activation = (async () => {
      if (!('serviceWorker' in navigator) || !('caches' in window))
        throw new Error('This browser does not provide the required complete video cache')
      const script = new URL(`${import.meta.env.BASE_URL}video-cache-worker.js`, location.href)
      await navigator.serviceWorker.register(script, {scope: import.meta.env.BASE_URL, updateViaCache: 'none'})
      await navigator.serviceWorker.ready
      const isOurs = () => navigator.serviceWorker.controller &&
        new URL(navigator.serviceWorker.controller.scriptURL).pathname === script.pathname
      if (!isOurs()) await new Promise<void>((resolve, reject) => {
        const changed = () => { if (isOurs()) { cleanup(); resolve() } }
        const timeout = window.setTimeout(() => { cleanup(); reject(new Error('Video cache control timed out')) }, 30000)
        const cleanup = () => { window.clearTimeout(timeout); navigator.serviceWorker.removeEventListener('controllerchange', changed) }
        navigator.serviceWorker.addEventListener('controllerchange', changed)
        changed()
      })
      navigator.serviceWorker.controller?.postMessage({type: 'portfolio-video-trim', release})
    })()
    control = Promise.race([activation, new Promise<never>((_, reject) => {
      timer = window.setTimeout(() => reject(new Error('Video cache activation timed out')), 30000)
    })]).finally(() => window.clearTimeout(timer)).catch(error => { control = undefined; throw error })
  }
  return control
}
function makePlayer() {
  if (!host) {
    host = document.createElement('div')
    host.setAttribute('aria-hidden', 'true'); host.inert = true
    host.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;overflow:hidden;pointer-events:none;z-index:-1'
    document.body.append(host)
  }
  const video = document.createElement('video')
  video.crossOrigin = 'anonymous'
  video.muted = video.defaultMuted = true
  video.playsInline = video.loop = true
  video.preload = 'auto'
  host.append(video)
  return video
}
async function waitForFrame(video: HTMLVideoElement) {
  const until = performance.now() + 60000
  while (video.readyState < 2 || !video.videoWidth || video.seeking) {
    if (video.error) throw new Error(`Video ${video.error.code}: ${video.error.message}`)
    if (performance.now() > until) throw new Error('Cached video frame preparation timed out')
    await new Promise(resolve => window.setTimeout(resolve, 50))
  }
  if (video.error) throw new Error(video.error.message)
}
export function requestVideo(value: string, priority: number, retry = false) {
  const original = key(value)
  const path = new URL(original).pathname + new URL(original).search
  return resources.request(`video:${path}`, async () => {
    if (players.has(original)) return
    await prepareVideoCache()
    const playback = new URL(original)
    playback.searchParams.set('portfolio-video', release)
    const cache = await caches.open(CACHE_NAME)
    let response = await cache.match(playback.href)
    if (!response) {
      const controller = new AbortController()
      const timer = window.setTimeout(() => controller.abort(), 180000)
      try {
        const downloaded = await fetch(original, {signal: controller.signal, cache: 'default'})
        if (!downloaded.ok || downloaded.status !== 200) throw new Error(`Incomplete video HTTP ${downloaded.status}`)
        const blob = await downloaded.blob()
        if (!blob.size) throw new Error(`Empty video: ${original}`)
        response = new Response(blob, {headers: {
          'Content-Type': 'video/mp4', 'Content-Length': String(blob.size),
          'Cache-Control': 'public, max-age=31536000, immutable', 'Accept-Ranges': 'bytes',
        }})
        await cache.put(playback.href, response.clone())
      } finally { window.clearTimeout(timer) }
    }
    const bytes = Number(response.headers.get('Content-Length'))
    if (!Number.isFinite(bytes) || bytes <= 0) throw new Error('Invalid complete video cache entry')
    const video = makePlayer()
    try {
      video.src = playback.href
      video.load()
      void video.play().catch(() => undefined)
      await waitForFrame(video)
      video.pause()
      if (video.currentTime > 0) video.currentTime = 0
      await waitForFrame(video)
      players.set(original, {element: video, bytes, method: 'range-aware-cache'})
    } catch (error) {
      video.pause(); video.removeAttribute('src'); video.load(); video.remove()
      throw error
    }
  }, priority, {retry})
}
Object.defineProperty(window, '__portfolioVideoCache', {get: () => [...players].map(([url, value]) => ({
  url, bytes: value.bytes, method: value.method, ready: value.element.readyState,
  error: value.element.error?.message || null,
}))})
