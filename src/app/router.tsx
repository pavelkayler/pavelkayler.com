import { createBrowserRouter, Navigate } from 'react-router-dom'
import { MainLayout } from '../layouts/MainLayout'
import { HomePage } from '../pages/HomePage'
import { lazyRoute } from './routeModules'

const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/'

export const router = createBrowserRouter(
  [
    {
      element: <MainLayout />,
      children: [
        { index: true, element: <HomePage /> },
        { path: 'works', lazy: lazyRoute('works') },
        { path: 'portraits', lazy: lazyRoute('portraits') },
        { path: 'projects', lazy: lazyRoute('projects') },
        { path: 'brands', lazy: lazyRoute('brands') },
        { path: 'contacts', lazy: lazyRoute('contacts') },
        { path: '*', element: <Navigate to="/" replace /> },
      ],
    },
  ],
  { basename },
)
