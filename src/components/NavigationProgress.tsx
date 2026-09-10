import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate, useNavigation } from 'react-router-dom'
import { getInitialPhase, getNavigationStatus, recoverNavigation, subscribeInitialPhase,
  subscribeNavigation, type NavigationStatus } from '../app/siteLoading'
import { loadingPercent } from '../app/loadingProgress'
import { lockLoadingOverlay } from '../app/loadingOverlay'

export function NavigationProgress() {
  const state = useSyncExternalStore(subscribeNavigation, getNavigationStatus)
  const phase = useSyncExternalStore(subscribeInitialPhase, getInitialPhase)
  const navigation = useNavigation()
  const location = useLocation()
  const navigate = useNavigate()
  const pending = phase !== 'loading' && (state !== null || navigation.state !== 'idle')
  const [visible, setVisible] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [complete, setComplete] = useState(false)
  const lastState = useRef<NavigationStatus | null>(null)
  const overlay = useRef<HTMLDivElement>(null)
  const cancel = useRef<() => void>(() => undefined)

  useLayoutEffect(() => {
    if (state) lastState.current = state
  }, [state])
  useLayoutEffect(() => {
    cancel.current = () => {
      if (!pending) return
      // The destination has not committed. Replace with the current route to
      // abort its pending loader, rather than adding an extra history entry.
      void navigate(location.pathname + location.search + location.hash,
        { replace: true, preventScrollReset: true })
    }
  }, [pending, navigate, location])

  useEffect(() => {
    let firstFrame = 0
    let secondFrame = 0
    let timer: number | undefined
    if (pending) {
      setLeaving(false)
      setComplete(false)
      // Already-cached transitions should not flash a full-screen overlay.
      timer = window.setTimeout(() => setVisible(true), 120)
    } else if (visible) {
      // Keep the mask until React Router has committed the destination and it
      // has had a paint opportunity. Clearing the resource status alone is earlier.
      firstFrame = requestAnimationFrame(() => {
        secondFrame = requestAnimationFrame(() => {
          const last = lastState.current
          setComplete(Boolean(last && last.total > 0 && last.ready >= last.total && last.failed === 0))
          setLeaving(true)
          timer = window.setTimeout(() => setVisible(false),
            window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 180)
        })
      })
    }
    return () => {
      window.clearTimeout(timer)
      cancelAnimationFrame(firstFrame)
      cancelAnimationFrame(secondFrame)
    }
  }, [pending, visible, location.key])

  useLayoutEffect(() => {
    if (!visible || !overlay.current) return
    return lockLoadingOverlay(overlay.current, () => cancel.current())
  }, [visible])

  if (!visible) return null
  const current = state ?? lastState.current
  const percent = loadingPercent(current?.ready ?? 0, current?.total ?? 0, complete && !pending)
  const failed = pending && (current?.failed ?? 0) > 0
  const recovery = pending && (failed || current?.slow)
  return createPortal(
    <div id="route-loader" ref={overlay} tabIndex={-1}
      className={`loading-overlay${leaving ? ' is-hidden' : ''}`}
      role="dialog" aria-modal="true" aria-label="Загрузка страницы">
      <div className="site-loader-content">
        <div className="site-loader-meter" role="progressbar" aria-label="Загрузка страницы"
          aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
          <span className="site-loader-spinner" aria-hidden="true" />
          <span className="site-loader-percentage" aria-hidden="true">{percent}%</span>
        </div>
        {failed && <span className="site-loader-error" role="alert">Не удалось загрузить часть данных.</span>}
        {recovery && <div className="site-loader-actions">
          {failed && <button type="button" onClick={() => recoverNavigation('retry')}>Повторить загрузку</button>}
          <button type="button" onClick={() => recoverNavigation('continue')}>Открыть доступную часть</button>
        </div>}
      </div>
    </div>, document.body,
  )
}
