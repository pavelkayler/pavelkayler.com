import { album } from '../content/pages/brands'
import { GalleryPage } from './GalleryPage'

export function BrandsPage() {
  return <GalleryPage pageKey="brands" album={album} />
}
