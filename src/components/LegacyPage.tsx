import { useEffect, useMemo, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Masonry from 'masonry-layout'
import PhotoSwipeLightbox from 'photoswipe/lightbox'
import { pages, type PageKey } from '../generated/pages'

function withBase(value: string) {
  const base = import.meta.env.BASE_URL
  return value.replaceAll('__BASE__', base)
}

function upsertMeta(name: string, content: string) {
  let meta = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)
  if (!meta) {
    meta = document.createElement('meta')
    meta.name = name
    document.head.append(meta)
  }
  meta.content = content
}

function updateCanonical(path: string) {
  let link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (!link) {
    link = document.createElement('link')
    link.rel = 'canonical'
    document.head.append(link)
  }
  link.href = `https://pavelkayler.com${path}`
}

export function LegacyPage({ pageKey }: { pageKey: PageKey }) {
  const page = pages[pageKey]
  const html = useMemo(() => withBase(page.html), [page.html])
  const rootRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    document.title = page.title
    upsertMeta('description', page.description)
    updateCanonical(page.path)
    document.body.className = page.bodyClass
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [page, location.pathname])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const onClick = (event: MouseEvent) => {
      const target = event.target as Element | null
      const anchor = target?.closest<HTMLAnchorElement>('a[href]')
      if (!anchor || anchor.classList.contains('js-gallery-link')) return
      const href = anchor.getAttribute('href') || ''
      if (!href.startsWith('/')) return
      event.preventDefault()
      navigate(href)
    }
    root.addEventListener('click', onClick)

    const lightboxes: PhotoSwipeLightbox[] = []
    root.querySelectorAll<HTMLElement>('.js-gallery').forEach((gallery) => {
      const lightbox = new PhotoSwipeLightbox({
        gallery,
        children: 'a.js-gallery-link',
        pswpModule: () => import('photoswipe'),
        bgOpacity: 0.96,
        preload: [1, 2],
        wheelToZoom: true,
        showHideAnimationType: 'fade',
      })
      lightbox.init()
      lightboxes.push(lightbox)
    })

    const masonryInstances: Masonry[] = []
    root.querySelectorAll<HTMLElement>('.album-masonry').forEach((container) => {
      const masonry = new Masonry(container, {
        itemSelector: '.piece',
        percentPosition: true,
        transitionDuration: 0,
      })
      masonryInstances.push(masonry)
      container.querySelectorAll('img').forEach((image) => {
        image.addEventListener('load', () => masonry.layout(), { once: true })
      })
      requestAnimationFrame(() => masonry.layout())
    })

    return () => {
      root.removeEventListener('click', onClick)
      lightboxes.forEach((lightbox) => lightbox.destroy())
      masonryInstances.forEach((masonry) => masonry.destroy())
    }
  }, [html, navigate])

  return <div ref={rootRef} className="legacy-page react-route" dangerouslySetInnerHTML={{ __html: html }} />
}
