import { allRoutes, normalizeRoute, screenPlan, startupPlan } from '../content/loading-plan'
import { imageTaskId, imageUrl, requestImage, resources, type ImageSpec } from './imageResources'
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
      timer = window.setTimeout(() => reject(new Error(`Resource timed out: ${label}`)), 30000)
    })])
  } finally { window.clearTimeout(timer) }
}
export interface ResourceWork { ids: string[]; finished: Promise<boolean> }
function imageWork(specs: ImageSpec[], priority: number, retry: boolean) {
  return [...new Set(specs.map(imageUrl))].map(url => ({
    id: imageTaskId(url), promise: requestImage(url, priority, true, retry),
  }))
}
function work(tasks: { id: string; promise: Promise<void> }[]): ResourceWork {
  return { ids: [...new Set(tasks.map(task => task.id))],
    finished: Promise.allSettled(tasks.map(task => task.promise)).then(results => results.every(r => r.status === 'fulfilled')) }
}
export function resourceProgress(ids: string[]) {
  return { total: ids.length, ready: ids.filter(id => resources.get(id)?.state === 'ready').length,
    failed: ids.filter(id => resources.get(id)?.state === 'error').length }
}
function codeTask(path: string, priority: number, retry: boolean) {
  const id = `code:${path}`
  return { id, promise: resources.request(id, () => bounded(preloadRouteModule(path), id), priority, { retry }) }
}
let startupIds: string[] = []
/** Only the current route's first screen may block first paint. */
export function prepareStartup(path: string, retry = false): ResourceWork {
  const route = normalizeRoute(path)
  const routes = allRoutes.includes(route) ? [route] : []
  const fonts = 'fonts:site'
  const result = work([
    ...imageWork(startupPlan(route), 0, retry), ...routes.map(item => codeTask(item, 0, retry)),
    { id: fonts, promise: resources.request(fonts, () => bounded(Promise.all([
      document.fonts.load('400 16px Oswald', 'Home Works Contacts Портреты Проекты Бренды'),
      document.fonts.load('700 16px Oswald', 'Home Works Contacts Портреты Проекты Бренды'),
      document.fonts.load('400 16px "Font Awesome 5 Brands"', '\uf2c6\uf16d\uf189\uf167'),
    ]).then(() => document.fonts.ready), fonts).then(() => undefined), 0, { retry }) },
  ])
  startupIds = result.ids
  return result
}

/** Warm only the small route module. Background warm-up must never decode photographs. */
export function prepareCode(path: string, priority = 40) {
  path = normalizeRoute(path)
  if (!allRoutes.includes(path)) return
  return work([codeTask(path, priority, false)])
}

/** First-screen warm-up used only after explicit user intent. */
export function prepareScreen(path: string, priority = 5) {
  path = normalizeRoute(path)
  if (!allRoutes.includes(path)) return
  return work([...imageWork(screenPlan(path), priority, false), codeTask(path, priority, false)])
}

/** Never block the data-router commit. Promote the demanded route to foreground instead. */
export function prepareNavigation(path: string, _signal: AbortSignal) {
  if (getInitialPhase() !== 'loading') prepareScreen(path, 0)
  return null
}
Object.defineProperty(window, '__portfolioLoading', { configurable: true, get: () => ({
  phase: initialPhase, policy: 'intent-first-screens', startupIds: [...startupIds],
  tasks: resources.all().map(({ id, priority, state }) => ({ id, priority, state })),
}) })
