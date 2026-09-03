import { album } from '../generated/content/projects'
import { GalleryPage } from './GalleryPage'

export function ProjectsPage() {
  return <GalleryPage pageKey="projects" album={album} />
}
