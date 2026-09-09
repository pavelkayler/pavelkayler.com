import { useSyncExternalStore } from 'react'
import { getNavigationStatus, recoverNavigation, subscribeNavigation } from '../app/siteLoading'

export function NavigationProgress() {
  const state = useSyncExternalStore(subscribeNavigation, getNavigationStatus)
  if (!state) return null
  return (
    <div className="route-loading-status" role="status" aria-live="polite">
      <span className="site-loader-spinner" aria-hidden="true" />
      <span>Подготовка {state.label} · {state.ready} из {state.total}</span>
      {(state.failed > 0 || state.slow) && <div className="route-loading-actions">
        {state.failed > 0 && <button type="button" onClick={() => recoverNavigation('retry')}>Повторить загрузку</button>}
        <button type="button" onClick={() => recoverNavigation('continue')}>Открыть доступную часть</button>
      </div>}
    </div>
  )
}
