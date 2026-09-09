import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { useNavigation } from 'react-router-dom'
import { getNavigationStatus, recoverNavigation, subscribeNavigation } from '../app/siteLoading'
import { loadingPercent } from '../app/loadingProgress'

export function NavigationProgress() {
  const state = useSyncExternalStore(subscribeNavigation, getNavigationStatus)
  const navigation = useNavigation()
  const pending = navigation.state !== 'idle'
  const [visible, setVisible] = useState(false)
  const overlayRef = useRef<HTMLDivElement>(null)

  // Do not flash an overlay for an already-prepared route. Once shown, keep it
  // through the router commit, not just until the last resource promise settles.
  useEffect(() => {
    if (!pending) { setVisible(false); return }
    const timer = window.setTimeout(() => setVisible(true), 180)
    return () => window.clearTimeout(timer)
  }, [pending])
  const show = pending && visible

  useLayoutEffect(() => {
    if (!show) return
    const root = document.getElementById('root')
    const overlay = overlayRef.current
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const wasInert = root?.inert ?? false
    if (root) root.inert = true
    document.documentElement.dataset.navigationLoading = 'true'
    overlay?.focus({ preventScroll: true })
    return () => {
      if (root) root.inert = wasInert
      delete document.documentElement.dataset.navigationLoading
      if (previousFocus?.isConnected &&
          (document.activeElement === overlay || document.activeElement === document.body)) {
        previousFocus.focus({ preventScroll: true })
      }
    }
  }, [show])

  if (!show) return null
  const percentage = state ? loadingPercent(state.ready, state.total) : 100
  const needsRecovery = Boolean(state && (state.failed > 0 || state.slow))
  return createPortal(
    <div
      ref={overlayRef}
      id="route-loader"
      className="loading-overlay route-loading-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Загрузка страницы"
      tabIndex={-1}
      onKeyDown={event => {
        if (event.key !== 'Tab') return
        const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')]
        const first = buttons[0]
        const last = buttons[buttons.length - 1]
        if (!first) { event.preventDefault(); event.currentTarget.focus(); return }
        if (event.shiftKey && (document.activeElement === first || document.activeElement === event.currentTarget)) {
          event.preventDefault(); last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault(); first.focus()
        }
      }}
    >
      <div className="site-loader-content">
        <span className="site-loader-spinner" aria-hidden="true" />
        <span className="loading-percent" role="progressbar" aria-label="Готовность страницы"
          aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentage}>{percentage}%</span>
      </div>
      {needsRecovery && <div className="loading-recovery">
        {state && state.failed > 0 && <p role="status">Не удалось загрузить часть файлов.</p>}
        <div className="loading-actions">
          {state && state.failed > 0 && <button type="button" onClick={() => recoverNavigation('retry')}>Повторить загрузку</button>}
          <button type="button" onClick={() => recoverNavigation('continue')}>Открыть доступную часть</button>
        </div>
      </div>}
    </div>,
    document.body,
  )
}
