import { resources, resolveAsset } from './imageResources'

interface PosterRecord { url: string; image: HTMLImageElement }
const posters = new Map<string, PosterRecord>()
const key = (value: string) => new URL(resolveAsset(value), location.href).href
export const preparedPoster = (value: string) => posters.get(key(value))?.url

/** A video's poster request does not necessarily reuse an img element's cache.
 * Keep the two original poster files as decoded, document-scoped Blob URLs so
 * attaching a prepared video cannot make another origin request after startup.
 * No transcoding; the URLs and native handles live only as long as this document.
 */
export function requestCoverPoster(value: string, priority: number, retry = false) {
  const original = key(value)
  const source = new URL(original)
  const id = `poster:${source.pathname}${source.search}`
  return { id, promise: resources.request(id, async () => {
    if (posters.has(original)) return
    if (source.origin !== location.origin) throw new Error('Cover posters must be same-origin')
    const controller = new AbortController()
    const image = new Image()
    image.decoding = 'async'
    let objectUrl: string | undefined
    let timer: number | undefined
    try {
      await Promise.race([
        (async () => {
          const response = await fetch(original, { signal: controller.signal, cache: 'default' })
          if (!response.ok) throw new Error(`Poster HTTP ${response.status}: ${original}`)
          const blob = await response.blob()
          if (controller.signal.aborted) throw new Error('Poster preparation cancelled')
          if (!blob.size) throw new Error(`Empty poster: ${original}`)
          objectUrl = URL.createObjectURL(blob)
          image.src = objectUrl
          await image.decode()
          if (!image.naturalWidth) throw new Error(`Undecodable poster: ${original}`)
        })(),
        new Promise<never>((_, reject) => {
          timer = window.setTimeout(() => {
            controller.abort()
            reject(new Error(`Poster preparation timed out: ${original}`))
          }, 120000)
        }),
      ])
      posters.set(original, { url: objectUrl!, image })
    } catch (error) {
      controller.abort()
      image.removeAttribute('src')
      if (objectUrl) URL.revokeObjectURL(objectUrl)
      throw error
    } finally { window.clearTimeout(timer) }
  }, priority, { retry }) }
}
