import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import 'photoswipe/style.css'
import './styles/app.css'
import { dismissInitialLoader } from './app/initialLoader'
import { scheduleSiteWarmup } from './app/prefetch'
import { router } from './app/router'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)

void dismissInitialLoader().finally(() => {
  scheduleSiteWarmup(window.location.pathname)
})
