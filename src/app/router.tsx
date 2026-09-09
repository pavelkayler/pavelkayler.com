import { createBrowserRouter, type LoaderFunctionArgs } from 'react-router-dom'
import { MainLayout } from '../layouts/MainLayout'
import { HomePage } from '../pages/HomePage'
import { NotFoundPage } from '../pages/NotFoundPage'
import { lazyRoute } from './routeModules'

import { prepareNavigation } from './siteLoading'

const ready = (path: string) => ({ request }: LoaderFunctionArgs) => prepareNavigation(path, request.signal)

const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/'

export const router = createBrowserRouter(
  [
    {
      element: <MainLayout />,
      hydrateFallbackElement: null,
      children: [
        { index: true, element: <HomePage />, loader: ready('/') },
        { path: 'works', lazy: lazyRoute('works'), loader: ready('/works') },
        { path: 'portraits', lazy: lazyRoute('portraits'), loader: ready('/portraits') },
        { path: 'projects', lazy: lazyRoute('projects'), loader: ready('/projects') },
        { path: 'brands', lazy: lazyRoute('brands'), loader: ready('/brands') },
        { path: 'contacts', lazy: lazyRoute('contacts'), loader: ready('/contacts') },
        { path: '*', element: <NotFoundPage /> },
      ],
    },
  ],
  { basename },
)
