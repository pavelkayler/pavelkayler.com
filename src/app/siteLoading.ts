import { allRoutes, albumPlan, coverVideos, fullscreenImages, mainPlans, normalizeRoute,
  routeName, screenPlan, startupPlan } from '../content/loading-plan'
import { imageTaskId, imageUrl, requestImage, requestVideo, resources, resolveAsset,
  subscribeViewport, waitAbortable, type ImageSpec } from './imageResources'
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

function codeTask(path: string, priority: number, retry: boolean) {
  const id = `code:${path}`
  return { id, promise: resources.request(id, () => preloadRouteModule(path), priority, { retry }) }
}
function viewerTask(priority: number, retry: boolean) {
  const id = 'code:photo-viewer'
  return { id, promise: resources.request(id, async () => {
    await Promise.all([import('photoswipe/lightbox'), import('photoswipe')])
  }, priority, { retry }) }
}
function fontTask(retry: boolean) {
  const id = 'fonts:site'
  return { id, promise: resources.request(id, async () => {
    await Promise.all([
      document.fonts.load('400 16px Oswald', 'Home Works Contacts Портреты Проекты Бренды'),
      document.fonts.load('700 16px Oswald', 'Home Works Contacts Портреты Проекты Бренды'),
      document.fonts.load('400 16px "Font Awesome 5 Brands"', '\uf2c6\uf16d\uf189\uf167'),
    ])
    await document.fonts.ready
  }, 0, { retry }) }
}

export interface ResourceWork { ids: string[]; finished: Promise<boolean> }
function imageWork(specs: ImageSpec[], priority: number, decode: boolean, retry: boolean) {
  return [...new Set(specs.map(imageUrl))].map(url => ({
    id: imageTaskId(url), promise: requestImage(url, priority, decode, retry),
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
export function prepareStartup(path: string, retry = false): ResourceWork {
  const routes = [...new Set(['/', '/works', '/contacts', path].filter(route => allRoutes.includes(route)))]
  return work([...imageWork(startupPlan(path), 0, true, retry),
    ...routes.map(route => codeTask(route, 0, retry)), viewerTask(0, retry), fontTask(retry)])
}
export function prepareScreen(path: string, priority = 0, retry = false): ResourceWork {
  return work([...imageWork(screenPlan(path), priority, priority <= 10, retry),
    codeTask(path, priority, retry), viewerTask(priority, retry)])
}

let backgroundStarted = false
function pauseBackground() {
  resources.setBackgroundPaused(document.hidden || !navigator.onLine)
}
function queueBackground() {
  for (const path of allRoutes) prepareScreen(path, 20)
  for (const path of allRoutes) imageWork(mainPlans[path] || albumPlan(path), 30, false, false)
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
  // Explicit user data-saving preference keeps all page-size images but avoids
  // speculatively transferring large zoom versions and full video files.
  if (!connection?.saveData) {
    for (const src of fullscreenImages) void requestImage(resolveAsset(src), 40).catch(() => undefined)
    for (const src of coverVideos) void requestVideo(resolveAsset(src), 50).catch(() => undefined)
  }
}
export function startSiteWarmup() {
  if (backgroundStarted) return
  backgroundStarted = true
  pauseBackground()
  document.addEventListener('visibilitychange', pauseBackground)
  window.addEventListener('offline', pauseBackground)
  window.addEventListener('online', () => {
    pauseBackground()
    // Retry failed image/speculative tasks only after a genuine reconnection.
    for (const task of resources.all()) {
      if (task.state === 'error') void resources.request(task.id, task.operation, task.priority, { retry: true })
    }
  })
  subscribeViewport(() => {
    // Never reuse a narrow-screen readiness decision after rotation/resizing.
    prepareScreen(currentSiteRoute(), 5)
    queueBackground()
  })
  queueBackground()
}

export interface NavigationStatus {
  path: string
  label: string
  ready: number
  total: number
  failed: number
  slow: boolean
}
let navigation: NavigationStatus | null = null
let recovery: ((action: 'retry' | 'continue') => void) | undefined
const navigationListeners = new Set<() => void>()
let generation = 0
export const getNavigationStatus = () => navigation
export const subscribeNavigation = (listener: () => void) => {
  navigationListeners.add(listener)
  return () => { navigationListeners.delete(listener) }
}
export const recoverNavigation = (action: 'retry' | 'continue') => recovery?.(action)
function publishNavigation(value: NavigationStatus | null) {
  navigation = value
  for (const listener of navigationListeners) listener()
}

/** Data-router loader: keeps the previous route painted until its successor is ready. */
export async function prepareNavigation(path: string, signal: AbortSignal) {
  // First entry renders behind the global loader; it handles the entire startup set.
  if (initialPhase === 'loading') return null
  path = normalizeRoute(path)
  const token = ++generation
  let slow = false
  let current: ResourceWork | undefined
  const update = () => {
    if (token !== generation || !current) return
    publishNavigation({ path, label: routeName(path), ...resourceProgress(current.ids), slow })
  }
  const unsubscribe = resources.subscribe(update)
  const timer = window.setTimeout(() => { slow = true; update() }, 10000)
  try {
    let retry = false
    while (!signal.aborted) {
      const action = new Promise<'retry' | 'continue'>(resolve => { recovery = resolve })
      current = prepareScreen(path, 0, retry)
      update()
      const result = await waitAbortable(Promise.race([current.finished, action]), signal)
      if (result === true || result === 'continue') return null
      const choice = result === false ? await waitAbortable(action, signal) : result
      if (choice === 'continue') return null
      retry = true
    }
    throw new DOMException('Navigation superseded', 'AbortError')
  } finally {
    unsubscribe()
    window.clearTimeout(timer)
    if (token === generation) { recovery = undefined; publishNavigation(null) }
  }
}

// Read-only diagnostics for support and regression tests. No control/backdoor API.
Object.defineProperty(window, '__portfolioLoading', { configurable: true, get: () => ({
  phase: initialPhase,
  tasks: resources.all().map(({ id, priority, state }) => ({ id, priority, state })),
}) })
