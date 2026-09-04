import { useEffect, useLayoutEffect } from 'react'
import { Outlet, ScrollRestoration, useLocation } from 'react-router-dom'
import { Header } from '../components/Header'
import { Footer } from '../components/Footer'
import { SiteLogo } from '../components/SiteLogo'
import { pages, type PageKey } from '../generated/pages'
import { scheduleRouteWarmup } from '../app/prefetch'
import { applyPageMetadata } from '../app/seo'

const routeToKey: Record<string, PageKey> = {
  '/': 'home',
  '/works': 'works',
  '/portraits': 'portraits',
  '/projects': 'projects',
  '/brands': 'brands',
  '/contacts': 'contacts',
}

function normalizePath(pathname: string) {
  if (pathname === '/') return '/'
  return pathname.replace(/\/+$/, '') || '/'
}

export function MainLayout() {
  const { pathname } = useLocation()
  const normalizedPath = normalizePath(pathname)
  const pageKey = routeToKey[normalizedPath]
  const page = pageKey ? pages[pageKey] : undefined
  const isHomeRoute = normalizedPath === '/'

  useLayoutEffect(() => {
    if (page) applyPageMetadata(page)
  }, [page])

  useEffect(() => scheduleRouteWarmup(normalizedPath), [normalizedPath])

  return (
    <div className={`page-wrapper react-page-wrapper${isHomeRoute ? ' is-home-route' : ''}`}>
      <Header overlay={page?.hasCover ?? false} />
      <div className="persistent-site-logo">
        <SiteLogo />
      </div>
      <Outlet />
      <Footer />
      <ScrollRestoration />
    </div>
  )
}
