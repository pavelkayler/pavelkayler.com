import { album } from '../generated/content/portraits'
import { GalleryPage } from './GalleryPage'

export function PortraitsPage() {
  return <GalleryPage pageKey="portraits" album={album} />
}
