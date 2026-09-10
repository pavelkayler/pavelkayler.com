import { allRoutes, albumPlan, fullscreenImages, mainPlans, screenPlan, normalizeRoute, coverVideos } from '../content/loading-plan'
import { imageCandidates, imageTaskId, imageUrl, requestImage, resources,
  resolveAsset, useResidentImageSelection, type ImageSpec } from './imageResources'
import { requestVideo } from './videoResources'
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
  return [...new Set(specs.map(imageUrl))].map(url => ({ id: imageTaskId(url), promise: requestImage(url, priority, decode, retry) }))
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

/** One gate for the full portfolio; no work is postponed until a page click. */
export function prepareStartup(_path: string, retry = false): ResourceWork {
  const core = ['/', '/works', '/contacts'].flatMap(path => screenPlan(path))
  const all = wholeSite()
  const additional = [...new Set([
    ...fullscreenImages.map(resolveAsset),
    ...all.map(spec => imageCandidates(spec).slice(-1)[0]?.url || resolveAsset(spec.src)),
    ...mainPlans['/'].flatMap(spec => imageCandidates(spec).map(item => item.url)),
  ])]
  const viewer = 'code:photo-viewer', fonts = 'fonts:site'
  return work([
    ...imageWork(core, 0, true, retry), ...allRoutes.map(path => codeTask(path, retry)),
    { id: viewer, promise: resources.request(viewer, () => bounded(
      Promise.all([import('photoswipe/lightbox'), import('photoswipe')]).then(() => undefined), viewer), 0, { retry }) },
    { id: fonts, promise: resources.request(fonts, () => bounded(
      Promise.all(Array.from(document.fonts, face => face.load())).then(() => document.fonts.ready), fonts).then(() => undefined), 0, { retry }) },
    ...imageWork(all, 2, true, retry),
    ...additional.map(url => ({ id: imageTaskId(url), promise: requestImage(url, 4, false, retry) })),
    ...coverVideos.map(src => ({ id: `video:${resolveAsset(src)}`, promise: requestVideo(src, 6, retry) })),
  ])
}
export function prepareNavigation(_path: string, _signal: AbortSignal) { return null }
Object.defineProperty(window, '__portfolioLoading', { configurable: true, get: () => ({
  phase: initialPhase, policy: 'single-startup', tasks: resources.all().map(({ id, priority, state }) => ({ id, priority, state })),
}) })
