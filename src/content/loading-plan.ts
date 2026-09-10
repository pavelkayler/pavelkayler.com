import { homeContent } from './pages/home'
import { worksContent } from './pages/works'
import { contactsContent } from './pages/contacts'
import { album as portraits } from './pages/portraits'
import { album as projects } from './pages/projects'
import { album as brands } from './pages/brands'
import { siteLogo } from './site'
import type { ImageSpec } from '../app/imageResources'

export const MAIN_IMAGE_SIZES = '(max-width: 768px) 100vw, 33vw'
export const GALLERY_IMAGE_SIZES = '(max-width: 768px) 50vw, 33vw'
export const RELATED_IMAGE_SIZES = '(max-width: 768px) 100vw, 50vw'
export const albums = { '/portraits': portraits, '/projects': projects, '/brands': brands }
export const allRoutes = ['/', '/works', '/contacts', ...Object.keys(albums)]
export const normalizeRoute = (path: string) => path.split(/[?#]/, 1)[0].replace(/\/+$/, '') || '/'
export const logoSpec: ImageSpec = { src: siteLogo.src }

export function screenPlan(path: string): ImageSpec[] {
  path = normalizeRoute(path)
  if (path === '/') return [logoSpec, { ...homeContent.cover.slides[0], sizes: '100vw' }]
  if (path === '/works') return [logoSpec, ...worksContent.cards.map(card => ({ ...card.image, sizes: MAIN_IMAGE_SIZES }))]
  if (path === '/contacts') return [logoSpec, { ...contactsContent.image, sizes: MAIN_IMAGE_SIZES }]
  const album = albums[path as keyof typeof albums]
  if (!album) return [logoSpec]
  // Prime the first row only. The rendered first-screen check promotes any additional
  // partially visible Masonry images before the startup mask disappears.
  return [logoSpec, ...(album.cover?.poster ? [{ src: album.cover.poster }] : []),
    ...album.photos.slice(0, 3).map(photo => ({ ...photo.image, sizes: GALLERY_IMAGE_SIZES }))]
}
export function startupPlan(path: string): ImageSpec[] {
  // Do not make entry to one page depend on assets from unrelated routes. Their first
  // screens are warmed shortly after reveal by scheduleSiteWarmup().
  return screenPlan(path)
}
