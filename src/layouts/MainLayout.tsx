import { useLayoutEffect } from 'react'
import { Outlet, ScrollRestoration, useLocation } from 'react-router-dom'
import { Header } from '../components/Header'
import { Footer } from '../components/Footer'
import { SiteLogo } from '../components/SiteLogo'
import { pages, type PageKey } from '../content/page-metadata'
import { applyPageMetadata } from '../app/seo'

const routeToKey: Record<string, PageKey> = {
  '/': 'home', '/works': 'works', '/portraits': 'portraits',
  '/projects': 'projects', '/brands': 'brands', '/contacts': 'contacts',
}
export function MainLayout() {
  const { pathname } = useLocation()
  const path = pathname.replace(/\/+$/, '') || '/'
  const key = routeToKey[path]
  const page = key ? pages[key] : undefined
  const routeClass = path === '/'
    ? ' is-home-route'
    : path === '/works'
      ? ' is-works-route'
      : ''

  useLayoutEffect(() => { if (page) applyPageMetadata(page) }, [page])

  return (
    <div className={`page-wrapper react-page-wrapper${routeClass}`}>
      <Header overlay={page?.hasCover ?? false} />
      {path !== '/' && <div className="persistent-site-logo static-header-site-logo"><SiteLogo /></div>}
      <Outlet />
      <Footer />
      <ScrollRestoration />
    </div>
  )
}
