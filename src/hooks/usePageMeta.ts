import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { pages, type PageKey } from '../generated/pages'

export function usePageMeta(pageKey: PageKey) {
  const page = pages[pageKey]
  const location = useLocation()

  useEffect(() => {
    document.body.className = page.bodyClass
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [location.pathname, page.bodyClass])

  return page
}
