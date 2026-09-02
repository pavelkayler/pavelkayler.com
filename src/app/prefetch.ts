import { pages, type PageKey } from '../generated/pages'

const routeToKey: Record<string, PageKey> = {
  '/': 'home',
  '/works': 'works',
  '/portraits': 'portraits',
  '/projects': 'projects',
  '/brands': 'brands',
  '/contacts': 'contacts',
}

const prefetched = new Set<string>()

function normalizePath(pathname: string) {
  const withoutQuery = pathname.split(/[?#]/, 1)[0] || '/'
  if (withoutQuery === '/') return '/'
  return withoutQuery.replace(/\/+$/, '')
}

export function prefetchRoute(pathname: string) {
  const key = routeToKey[normalizePath(pathname)]
  if (!key) return

  const base = import.meta.env.BASE_URL
  for (const asset of pages[key].prefetchAssets) {
    const href = `${base}${asset}`
    if (prefetched.has(href)) continue
    prefetched.add(href)

    const link = document.createElement('link')
    link.rel = 'prefetch'
    link.href = href
    document.head.append(link)
  }
}
