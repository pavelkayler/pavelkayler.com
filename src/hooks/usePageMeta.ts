import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { pages, type PageKey } from '../generated/pages'

export function usePageMeta(pageKey: PageKey) {
  const page = pages[pageKey]
  const location = useLocation()

  useEffect(() => {
    document.title = page.title

    let description = document.querySelector<HTMLMetaElement>('meta[name="description"]')
    if (!description) {
      description = document.createElement('meta')
      description.name = 'description'
      document.head.append(description)
    }
    description.content = page.description

    let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    if (!canonical) {
      canonical = document.createElement('link')
      canonical.rel = 'canonical'
      document.head.append(canonical)
    }
    canonical.href = `https://pavelkayler.com${page.path}`

    document.body.className = page.bodyClass
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [location.pathname, page])

  return page
}
