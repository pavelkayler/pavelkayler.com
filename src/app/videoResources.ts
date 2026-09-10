import { resources, resolveAsset } from './imageResources'

interface VideoRecord { element: HTMLVideoElement; bytes: number; method: string; objectUrl?: string }
const players = new Map<string, VideoRecord>()
const key = (value: string) => new URL(resolveAsset(value), location.href).href
export const preparedVideo = (value: string) => players.get(key(value))?.element

function player() {
  const video = document.createElement('video')
  video.muted = true
  video.defaultMuted = true
  video.playsInline = true
  video.loop = true
  video.preload = 'auto'
  return video
}
function release(video: HTMLVideoElement) {
  video.pause()
  try { video.srcObject = null } catch { /* A URL-backed player needs no srcObject cleanup. */ }
  video.removeAttribute('src')
  video.replaceChildren()
  video.load()
  video.remove()
}
async function frameReady(video: HTMLVideoElement, requireFullBuffer: boolean) {
  const start = performance.now()
  for (;;) {
    if (video.error) throw new Error(`Video ${video.error.code}: ${video.error.message}`)
    const buffered = !requireFullBuffer || (Number.isFinite(video.duration) && video.buffered.length > 0 &&
      video.buffered.start(0) <= 0.1 && video.buffered.end(video.buffered.length - 1) >= video.duration - 0.1)
    if (video.readyState >= 2 && video.videoWidth > 0 && buffered) return
    if (performance.now() - start > 25000) throw new Error('Video preparation timed out')
    await new Promise(resolve => window.setTimeout(resolve, 50))
  }
}

export function requestVideo(value: string, priority: number, retry = false) {
  const url = key(value)
  const idUrl = new URL(url).pathname + new URL(url).search
  return resources.request(`video:${idUrl}`, async () => {
    if (players.has(url)) return
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 180000)
    let blob: Blob
    try {
      const response = await fetch(url, { signal: controller.signal, cache: 'default' })
      if (!response.ok) throw new Error(`Video HTTP ${response.status}: ${url}`)
      blob = await response.blob()
      if (!blob.size) throw new Error(`Empty video: ${url}`)
    } finally { window.clearTimeout(timeout) }
    // Preserve a successfully prepared native player instead of asking a new video
    // element to rediscover a large cached response on every route change.
    const errors: string[] = []
    for (const method of ['src-object', 'typed-source', 'native-http']) {
      const video = player()
      let objectUrl: string | undefined
      try {
        if (method === 'src-object') {
          // Blob srcObject is implemented by some engines; probe it, do not UA-sniff.
          Reflect.set(video, 'srcObject', blob)
        } else if (method === 'typed-source') {
          objectUrl = URL.createObjectURL(blob)
          const source = document.createElement('source')
          source.type = 'video/mp4'
          source.src = objectUrl
          video.append(source)
        } else {
          video.src = url
        }
        video.load()
        await frameReady(video, method === 'native-http')
        video.pause()
        players.set(url, { element: video, bytes: blob.size, method, objectUrl })
        return
      } catch (error) {
        errors.push(`${method}: ${String(error)}`)
        release(video)
        if (objectUrl) URL.revokeObjectURL(objectUrl)
      }
    }
    throw new Error(`Unable to prepare ${url}: ${errors.join('; ')}`)
  }, priority, { retry })
}
Object.defineProperty(window, '__portfolioVideoCache', { get: () => [...players].map(([url, value]) => ({
  url, bytes: value.bytes, method: value.method, ready: value.element.readyState,
  error: value.element.error?.message || null,
})) })
