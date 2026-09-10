import { useLayoutEffect, useState, useSyncExternalStore } from 'react'
import { useLocation } from 'react-router-dom'
import { currentSiteRoute, getInitialPhase, pageMayBePartial } from '../app/siteLoading'
import { subscribeViewport, viewportSnapshot } from '../app/imageResources'
import { decodeRenderedPage, renderedPageIsReady } from '../app/pageImages'

interface PaintState { failed: number; slow: boolean }

/** Last-mile gate: actual mounted images, not only detached preloader promises. */
export function usePageImagesReady() {
  const location = useLocation()
  const viewport = useSyncExternalStore(subscribeViewport, viewportSnapshot)
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<PaintState | null>(null)

  useLayoutEffect(() => {
    // Startup has its own all-image decode gate; explicit partial entry must remain possible.
    if (getInitialPhase() === 'loading' || pageMayBePartial(currentSiteRoute()) || renderedPageIsReady()) {
      setState(null)
      return
    }
    const controller = new AbortController()
    setState({ failed: 0, slow: false })
    const timer = window.setTimeout(() => {
      if (!controller.signal.aborted) setState(current => current && { ...current, slow: true })
    }, 10000)
    void decodeRenderedPage(controller.signal, attempt > 0).then(() => {
      if (!controller.signal.aborted) setState(null)
    }, () => {
      if (!controller.signal.aborted) setState({ failed: 1, slow: false })
    }).finally(() => window.clearTimeout(timer))
    return () => { controller.abort(); window.clearTimeout(timer) }
  }, [location.key, viewport, attempt])

  return { state, retry: () => setAttempt(value => value + 1), continue: () => setState(null) }
}
