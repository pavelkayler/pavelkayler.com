import { allRoutes } from '../content/loading-plan'
import { getInitialPhase, prepareScreen } from './siteLoading'
import { resources } from './imageResources'

export function prefetchRoute(path: string) {
  if (getInitialPhase() !== 'loading') prepareScreen(path, 20)
}
let scheduled = false
/** A small, nonblocking warm-up of other first screens, not all their images. */
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
    for (const route of allRoutes) if (route !== path) prepareScreen(route, 30)
  }, 1500)
}
