import { allRoutes, albumPlan, coverVideos, fullscreenImages, mainPlans, screenPlan,
  normalizeRoute } from '../content/loading-plan'
import { imageCandidates, imageTaskId, imageUrl, requestImage, requestVideo, resources,
  resolveAsset, useResidentImageSelection, type ImageSpec } from './imageResources'
import { preloadRouteModule } from './routeModules'

export type InitialPhase = 'loading' | 'ready' | 'degraded'
let initialPhase: InitialPhase = 'loading'
const phaseListeners = new Set<() => void>()
export const getInitialPhase = () => initialPhase
export const subscribeInitialPhase = (listener: () => void) => {
  phaseListeners.add(listener)
  return () => { phaseListeners.delete(listener) }
}
export function finishInitialLoading(phase: 'ready' | 'degraded') {
  initialPhase = phase
  if (phase === 'ready') useResidentImageSelection()
  document.documentElement.dataset.siteLoadState = phase
  for (const listener of phaseListeners) listener()
}
export function currentSiteRoute() {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '')
  const path = window.location.pathname
  return normalizeRoute(base && path.startsWith(`${base}/`) ? path.slice(base.length) : path)
}
async function bounded<T>(promise: Promise<T>, label: string): Promise<T> {
  let timer: number | undefined
  try {
    return await Promise.race([promise, new Promise<T>((_, reject) => {
      timer = window.setTimeout(() => reject(new Error(`Resource timed out: ${label}`)), 120000)
    })])
  } finally { window.clearTimeout(timer) }
}
export interface ResourceWork { ids: string[]; finished: Promise<boolean> }
function work(tasks: { id: string; promise: Promise<void> }[]): ResourceWork {
  return { ids: [...new Set(tasks.map(task => task.id))],
    finished: Promise.allSettled(tasks.map(task => task.promise)).then(results => results.every(r => r.status === 'fulfilled')) }
}
function imageWork(specs: ImageSpec[], priority: number, decode: boolean, retry: boolean) {
  return [...new Set(specs.map(imageUrl))].map(url => ({ id: imageTaskId(url),
    promise: requestImage(url, priority, decode, retry) }))
}
export function resourceProgress(ids: string[]) {
  return { total: ids.length, ready: ids.filter(id => resources.get(id)?.state === 'ready').length,
    failed: ids.filter(id => resources.get(id)?.state === 'error').length }
}
function codeTask(path: string, retry: boolean) {
  const id = `code:${path}`
  return { id, promise: resources.request(id, () => bounded(preloadRouteModule(path), id), 0, { retry }) }
}
const wholeSite = () => allRoutes.flatMap(path => [...screenPlan(path), ...(mainPlans[path] || albumPlan(path))])

/** The one and only loading gate: every visitor-facing page, viewer and video. */
export function prepareStartup(_path: string, retry = false): ResourceWork {
  const core = ['/', '/works', '/contacts'].flatMap(path => screenPlan(path))
  const all = wholeSite()
  // Page-size variants are decoded now. Largest variants are also downloaded, so
  // zooming and rotating do not introduce transfers; avoid decoding all zoom files.
  const additional = [...new Set([
    ...fullscreenImages.map(resolveAsset),
    ...all.map(spec => imageCandidates(spec).slice(-1)[0]?.url || resolveAsset(spec.src)),
    // PhotoSwipe uses responsive srcsets on Home; warm every offered Home variant.
    ...mainPlans['/'].flatMap(spec => imageCandidates(spec).map(item => item.url)),
  ])]
  const viewer = 'code:photo-viewer'
  const fonts = 'fonts:site'
  return work([
    ...imageWork(core, 0, true, retry),
    ...allRoutes.map(path => codeTask(path, retry)),
    { id: viewer, promise: resources.request(viewer, () => bounded(
      Promise.all([import('photoswipe/lightbox'), import('photoswipe')]).then(() => undefined), viewer), 0, { retry }) },
    { id: fonts, promise: resources.request(fonts, () => bounded(Promise.all([
      document.fonts.load('400 16px Oswald', 'Home Works Contacts Портреты Проекты Бренды'),
      document.fonts.load('700 16px Oswald', 'Home Works Contacts Портреты Проекты Бренды'),
      document.fonts.load('400 16px "Font Awesome 5 Brands"', '\uf2c6\uf16d\uf189\uf167'),
    ]).then(() => document.fonts.ready), fonts).then(() => undefined), 0, { retry }) },
    ...imageWork(all, 2, true, retry),
    ...additional.map(url => ({ id: imageTaskId(url), promise: requestImage(url, 4, false, retry) })),
    ...coverVideos.map(src => ({ id: `video:${resolveAsset(src)}`, promise: requestVideo(src, 6, retry) })),
  ])
}

// No navigation-level readiness barrier or popup: everything was prepared on entry.
// An explicitly chosen partial startup remains usable, with native image fallbacks.
export function prepareNavigation(_path: string, _signal: AbortSignal) { return null }

// Diagnostics are read-only and describe actual work, not a synthetic progress timer.
Object.defineProperty(window, '__portfolioLoading', { configurable: true, get: () => ({
  phase: initialPhase,
  policy: 'single-startup',
  tasks: resources.all().map(({ id, priority, state }) => ({ id, priority, state })),
}) })
