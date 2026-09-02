import type { ComponentType } from 'react'

type LazyPageKey = 'works' | 'portraits' | 'projects' | 'brands' | 'contacts'
type LazyRouteModule = { Component: ComponentType }

const loaders: Record<LazyPageKey, () => Promise<LazyRouteModule>> = {
  works: () => import('../pages/WorksPage').then(({ WorksPage }) => ({ Component: WorksPage })),
  portraits: () => import('../pages/PortraitsPage').then(({ PortraitsPage }) => ({ Component: PortraitsPage })),
  projects: () => import('../pages/ProjectsPage').then(({ ProjectsPage }) => ({ Component: ProjectsPage })),
  brands: () => import('../pages/BrandsPage').then(({ BrandsPage }) => ({ Component: BrandsPage })),
  contacts: () => import('../pages/ContactsPage').then(({ ContactsPage }) => ({ Component: ContactsPage })),
}

const pathToKey: Record<string, LazyPageKey> = {
  '/works': 'works',
  '/portraits': 'portraits',
  '/projects': 'projects',
  '/brands': 'brands',
  '/contacts': 'contacts',
}

const pending = new Map<LazyPageKey, Promise<LazyRouteModule>>()

function load(key: LazyPageKey) {
  let promise = pending.get(key)
  if (!promise) {
    promise = loaders[key]()
    pending.set(key, promise)
  }
  return promise
}

export function lazyRoute(key: LazyPageKey) {
  return () => load(key)
}

export function preloadRouteModule(pathname: string) {
  const normalized = pathname === '/' ? '/' : pathname.split(/[?#]/, 1)[0].replace(/\/+$/, '')
  const key = pathToKey[normalized]
  return key ? load(key).then(() => undefined) : Promise.resolve()
}
