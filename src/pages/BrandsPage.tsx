import { album } from '../generated/content/brands'
import { GalleryPage } from './GalleryPage'

export function BrandsPage() {
  return <GalleryPage pageKey="brands" album={album} />
}
