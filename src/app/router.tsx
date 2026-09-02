import { createBrowserRouter, Navigate } from 'react-router-dom'
import { MainLayout } from '../layouts/MainLayout'
import { HomePage } from '../pages/HomePage'
import { WorksPage } from '../pages/WorksPage'
import { ContactsPage } from '../pages/ContactsPage'
import { GalleryPage } from '../pages/GalleryPage'

const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/'

export const router = createBrowserRouter(
  [
    {
      element: <MainLayout />,
      children: [
        { index: true, element: <HomePage /> },
        { path: 'works', element: <WorksPage /> },
        { path: 'portraits', element: <GalleryPage pageKey="portraits" /> },
        { path: 'projects', element: <GalleryPage pageKey="projects" /> },
        { path: 'brands', element: <GalleryPage pageKey="brands" /> },
        { path: 'contacts', element: <ContactsPage /> },
        { path: '*', element: <Navigate to="/" replace /> },
      ],
    },
  ],
  { basename },
)
