import { useLayoutEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { pages, type PageKey } from '../content/page-metadata'

export function usePageMeta(pageKey: PageKey) {
  const page = pages[pageKey]
  const location = useLocation()

  useLayoutEffect(() => {
    document.body.className = page.bodyClass
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [location.pathname, page.bodyClass])

  return page
}
