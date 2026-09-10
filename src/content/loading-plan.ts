/** Resource plans are derived from maintained page content, not a six-image sample. */
import { homeContent } from './pages/home'
import { worksContent } from './pages/works'
import { contactsContent } from './pages/contacts'
import { album as portraits } from './pages/portraits'
import { album as projects } from './pages/projects'
import { album as brands } from './pages/brands'
import { siteLogo } from './site'
import type { ImageSpec } from '../app/imageResources'
import type { StructuredImage } from './types'

export const MAIN_IMAGE_SIZES = '(max-width: 768px) 100vw, 33vw'
export const GALLERY_IMAGE_SIZES = '(max-width: 768px) 50vw, 33vw'
export const RELATED_IMAGE_SIZES = '(max-width: 768px) 100vw, 50vw'
export const homePictureSpecs = homeContent.pictureRows.flatMap(row => row.columns.map(column => ({
  ...column.image, sizes: row.columns.length > 1 ? '(max-width: 768px) 100vw, 50vw' : '100vw',
})))
const cardSpecs = worksContent.cards.map(card => ({ ...card.image, sizes: MAIN_IMAGE_SIZES }))
export const mainPlans: Record<string, ImageSpec[]> = {
  '/': [...homeContent.cover.slides.map(slide => ({ ...slide, sizes: '100vw' })), ...homePictureSpecs,
    ...homeContent.works.map(card => ({ ...card.image, sizes: MAIN_IMAGE_SIZES }))],
  '/works': cardSpecs,
  '/contacts': [{ ...contactsContent.image, sizes: MAIN_IMAGE_SIZES }],
}
export const albums = { '/portraits': portraits, '/projects': projects, '/brands': brands }
export const allRoutes = [...Object.keys(mainPlans), ...Object.keys(albums)]
export const normalizeRoute = (path: string) => path.split(/[?#]/, 1)[0].replace(/\/+$/, '') || '/'
const routeNames: Record<string, string> = { '/': 'Home', '/works': 'Works', '/contacts': 'Contacts',
  '/portraits': 'Portraits', '/projects': 'Projects', '/brands': 'Brands' }
export const routeName = (path: string) => routeNames[path] || 'страницы'
export const logoSpec: ImageSpec = { src: siteLogo.src }

export function albumPlan(path: string): ImageSpec[] {
  const album = albums[path as keyof typeof albums]
  if (!album) return []
  return [
    ...(album.cover?.poster ? [{ src: album.cover.poster }] : []),
    ...album.photos.map(photo => ({ ...photo.image, sizes: GALLERY_IMAGE_SIZES })),
    ...album.related.map(card => ({ ...card.image, sizes: RELATED_IMAGE_SIZES })),
  ]
}
export function screenPlan(path: string): ImageSpec[] {
  const main = mainPlans[path]
  if (main) return [logoSpec, ...main]
  const album = albums[path as keyof typeof albums]
  if (!album) return [logoSpec]
  return [logoSpec, ...(album.cover?.poster ? [{ src: album.cover.poster }] : []),
    ...album.photos.slice(0, 6).map(photo => ({ ...photo.image, sizes: GALLERY_IMAGE_SIZES }))]
}
export function startupPlan(path: string): ImageSpec[] {
  return [logoSpec, ...Object.values(mainPlans).flat(), ...screenPlan(path)]
}
export function largestImage(image: StructuredImage) {
  const variants = image.srcSet.split(',').flatMap(part => {
    const match = part.trim().match(/^(\S+)\s+(\d+)w$/)
    return match ? [{ src: match[1], width: Number(match[2]) }] : []
  }).sort((a, b) => b.width - a.width)
  return variants[0]?.src || image.src
}
export const fullscreenImages = [
  ...homeContent.pictureRows.flatMap(row => row.columns.map(column => largestImage(column.image))),
  ...Object.values(albums).flatMap(album => album.photos.map(photo => photo.fullscreenSrc)),
]
export const coverVideos = Object.values(albums).flatMap(album => album.cover?.videoSrc ? [album.cover.videoSrc] : [])
