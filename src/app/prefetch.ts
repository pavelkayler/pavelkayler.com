import { allRoutes } from '../content/loading-plan'
import { getInitialPhase, prepareCode, prepareScreen } from './siteLoading'
import { resources } from './imageResources'

/** Explicit user intent may warm the destination first screen. Hover/focus use 5; pointer-down uses 0. */
export function prefetchRoute(path: string, priority = 5) {
  if (getInitialPhase() !== 'loading') prepareScreen(path, priority)
}
let scheduled = false
/** Quietly warm only route JavaScript. Never spend background bandwidth/CPU decoding other pages' photos. */
export function scheduleSiteWarmup(path: string) {
  if (scheduled) return
  scheduled = true
  const pause = () => resources.setBackgroundPaused(document.hidden || !navigator.onLine)
  document.addEventListener('visibilitychange', pause)
  window.addEventListener('online', pause)
  window.addEventListener('offline', pause)
  pause()
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection
  if (connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType || '')) return
  window.setTimeout(() => {
    for (const route of allRoutes) if (route !== path) prepareCode(route, 40)
  }, 1800)
}
