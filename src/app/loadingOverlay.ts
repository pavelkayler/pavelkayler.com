/** Keep keyboard/touch interaction inside an opaque loader without moving the scroll position. */
export function lockLoadingOverlay(overlay: HTMLElement, cancel?: () => void) {
  const root = document.getElementById('root')
  const previousInert = root?.inert ?? false
  const previousLock = document.documentElement.getAttribute('data-overlay-loading')
  const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
  if (root) root.inert = true
  document.documentElement.setAttribute('data-overlay-loading', 'true')
  overlay.focus({ preventScroll: true })

  const keydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && cancel) {
      event.preventDefault()
      event.stopPropagation()
      cancel()
      return
    }
    if (event.key !== 'Tab') return
    const buttons = [...overlay.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')]
      .filter(button => button.getClientRects().length > 0)
    if (!buttons.length) {
      event.preventDefault()
      overlay.focus({ preventScroll: true })
      return
    }
    const first = buttons[0]
    const last = buttons[buttons.length - 1]
    const active = document.activeElement
    if (event.shiftKey && (active === first || !buttons.includes(active as HTMLButtonElement))) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && (active === last || !buttons.includes(active as HTMLButtonElement))) {
      event.preventDefault()
      first.focus()
    }
  }
  document.addEventListener('keydown', keydown, true)
  return () => {
    document.removeEventListener('keydown', keydown, true)
    if (root) root.inert = previousInert
    if (previousLock === null) document.documentElement.removeAttribute('data-overlay-loading')
    else document.documentElement.setAttribute('data-overlay-loading', previousLock)
    if (previousFocus?.isConnected && !previousFocus.closest('[inert]')) {
      previousFocus.focus({ preventScroll: true })
    }
  }
}
