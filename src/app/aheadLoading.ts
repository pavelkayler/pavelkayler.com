/** Native lazy loading with three-screen coverage: the viewport plus two below. */
const SCREENS_AHEAD = 2
interface Group {
  callbacks: Map<Element, () => void>
  observer: IntersectionObserver
  resize?: ResizeObserver
  rebuild: () => void
}
const groups = new Map<Element | null, Group>()
export function scrollingRoot(element: Element): Element | null {
  for (let parent = element.parentElement; parent; parent = parent.parentElement) {
    if (parent === document.scrollingElement || parent === document.documentElement) return null
    // BODY can itself be the nested scrollport when the mobile theme combines
    // a viewport height with overflow-x:hidden (which computes overflow-y:auto).
    if (/(auto|scroll|overlay)/.test(getComputedStyle(parent).overflowY) &&
        parent.clientHeight > 0 && parent.scrollHeight > parent.clientHeight + 1) return parent
  }
  return null
}
function drop(root: Element | null, group: Group) {
  if (group.callbacks.size) return
  group.observer.disconnect()
  group.resize?.disconnect()
  window.removeEventListener('resize', group.rebuild)
  if (groups.get(root) === group) groups.delete(root)
}
export function observeAhead(element: Element, ready: () => void) {
  if (typeof IntersectionObserver === 'undefined') return () => undefined
  let detach: () => void = () => undefined
  const frame = requestAnimationFrame(() => {
    const root = scrollingRoot(element)
    let group = groups.get(root)
    if (!group) {
      const callbacks = new Map<Element, () => void>()
      const entry = {} as Group
      const rebuild = () => {
        entry.observer?.disconnect()
        const height = Math.max(1, root?.clientHeight || window.innerHeight)
        entry.observer = new IntersectionObserver(entries => {
          for (const item of entries) {
            if (!item.isIntersecting) continue
            const callback = callbacks.get(item.target)
            callbacks.delete(item.target)
            entry.observer.unobserve(item.target)
            callback?.()
          }
          drop(root, entry)
        }, { root, rootMargin: `0px 0px ${height * SCREENS_AHEAD}px 0px`, threshold: 0 })
        for (const target of callbacks.keys()) entry.observer.observe(target)
      }
      entry.callbacks = callbacks; entry.rebuild = rebuild
      group = entry
      groups.set(root, group)
      rebuild()
      if (root && typeof ResizeObserver !== 'undefined') {
        group.resize = new ResizeObserver(rebuild)
        group.resize.observe(root)
      }
      window.addEventListener('resize', rebuild, { passive: true })
    }
    const current = group
    current.callbacks.set(element, ready)
    current.observer.observe(element)
    detach = () => {
      current.callbacks.delete(element)
      current.observer.unobserve(element)
      drop(root, current)
    }
  })
  return () => { cancelAnimationFrame(frame); detach() }
}
