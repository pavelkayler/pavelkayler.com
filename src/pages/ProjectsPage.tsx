import { album } from '../content/pages/projects'
import { GalleryPage } from './GalleryPage'

export function ProjectsPage() {
  return <GalleryPage pageKey="projects" album={album} />
}
