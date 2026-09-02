import { createBrowserRouter, Navigate } from 'react-router-dom'
import { MainLayout } from '../layouts/MainLayout'
import { LegacyPage } from '../components/LegacyPage'
import { WorksPage } from '../pages/WorksPage'
import { ContactsPage } from '../pages/ContactsPage'

const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/'

export const router = createBrowserRouter(
  [
    {
      element: <MainLayout />,
      children: [
        { index: true, element: <LegacyPage pageKey="home" /> },
        { path: 'works', element: <WorksPage /> },
        { path: 'portraits', element: <LegacyPage pageKey="portraits" /> },
        { path: 'projects', element: <LegacyPage pageKey="projects" /> },
        { path: 'brands', element: <LegacyPage pageKey="brands" /> },
        { path: 'contacts', element: <ContactsPage /> },
        { path: '*', element: <Navigate to="/" replace /> },
      ],
    },
  ],
  { basename },
)
