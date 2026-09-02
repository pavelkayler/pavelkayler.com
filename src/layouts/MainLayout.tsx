import { Outlet, useLocation } from 'react-router-dom'
import { Header } from '../components/Header'
import { Footer } from '../components/Footer'
import { pages, type PageKey } from '../generated/pages'

const routeToKey: Record<string, PageKey> = {
  '/': 'home',
  '/works': 'works',
  '/portraits': 'portraits',
  '/projects': 'projects',
  '/brands': 'brands',
  '/contacts': 'contacts',
}

export function MainLayout() {
  const { pathname } = useLocation()
  const page = pages[routeToKey[pathname] ?? 'home']

  return (
    <div className="page-wrapper react-page-wrapper">
      <Header overlay={page?.hasCover ?? false} />
      <Outlet />
      <Footer />
    </div>
  )
}
