import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import 'photoswipe/style.css'
import './styles/app.css'
import './styles/works-spacing.css'
import './styles/logo-static.css'
import { dismissInitialLoader } from './app/initialLoader'
import { scheduleSiteWarmup } from './app/prefetch'
import { router } from './app/router'

createRoot(document.getElementById('root')!).render(
  <StrictMode><RouterProvider router={router} /></StrictMode>,
)
void dismissInitialLoader().then(() => scheduleSiteWarmup(window.location.pathname))

// Retire only our previous video-only worker, without blocking startup or wiping
// Cache Storage that a still-open old release could be playing from. New playback
// uses normal, unmarked URLs. Existing controlled tabs can finish their work.
if ('serviceWorker' in navigator) {
  const oldScript = new URL(`${import.meta.env.BASE_URL}video-cache-worker.js`, location.href).href
  void navigator.serviceWorker.getRegistrations().then(registrations => Promise.all(
    registrations.filter(registration => [registration.active, registration.waiting, registration.installing]
      .some(worker => worker?.scriptURL === oldScript)).map(registration => registration.unregister()),
  )).catch(() => undefined)
}
