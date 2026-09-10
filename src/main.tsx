import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import 'photoswipe/style.css'
import './styles/app.css'
import { dismissInitialLoader } from './app/initialLoader'
import { prepareVideoCache } from './app/videoResources'
import { router } from './app/router'

async function start() {
  // Establish the video's narrowly scoped worker BEFORE any photo preload. A
  // controller change midway through startup separates native image-cache entries
  // and can make the subsequent route request images that were warmed beforehand.
  try { await prepareVideoCache() }
  catch { /* The regular startup video task reports this via retry/partial controls. */ }
  createRoot(document.getElementById('root')!).render(
    <StrictMode><RouterProvider router={router} /></StrictMode>,
  )
  await dismissInitialLoader()
}
void start()
