import { allRoutes, normalizeRoute } from '../content/loading-plan'
import { prepareScreen, startSiteWarmup, getInitialPhase } from './siteLoading'

type PrefetchMode = 'intent' | 'idle' | 'background'
export function prefetchRoute(pathname: string, mode: PrefetchMode = 'intent') {
  const path = normalizeRoute(pathname)
  if (!allRoutes.includes(path) || getInitialPhase() === 'loading') return
  prepareScreen(path, mode === 'intent' ? 5 : 20)
}
// Kept as the layout integration point. A single site-wide queue replaces route timers.
export function scheduleRouteWarmup(pathname: string) {
  if (getInitialPhase() !== 'loading') prepareScreen(normalizeRoute(pathname), 5)
  return () => undefined
}
export function scheduleSiteWarmup(_pathname: string) { startSiteWarmup() }
