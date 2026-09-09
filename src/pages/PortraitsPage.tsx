import { album } from '../content/pages/portraits'
import { GalleryPage } from './GalleryPage'

export function PortraitsPage() {
  return <GalleryPage pageKey="portraits" album={album} />
}
