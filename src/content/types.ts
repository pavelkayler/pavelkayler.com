export interface StructuredImage {
  src: string
  srcSet: string
  alt: string
  width: number
  height: number
  aspect: number
  placeholderWidth: number
  placeholderHeight: number
  placeholderColor: string
}

export interface WorksCard {
  to: string
  title: string
  image: StructuredImage
}

export interface GalleryPhoto {
  id: string
  aspect: number
  image: StructuredImage
  fullscreenSrc: string
  fullscreenWidth: number
  fullscreenHeight: number
}

export interface AlbumCover {
  title: string
  poster: string
  videoSrc: string
}

export interface AlbumContent {
  key: 'portraits' | 'projects' | 'brands'
  hasCover: boolean
  cover: AlbumCover | null
  photos: GalleryPhoto[]
  quote: string[]
  related: WorksCard[]
}

export interface HomePictureColumn {
  columnClass: string
  sectionClass: string
  image: StructuredImage
}

export interface HomePictureRow {
  containerClass: string
  columns: HomePictureColumn[]
}

export interface HomeAction {
  columnClass: string
  href: string
  label: string
  iconClass: string
}

export interface HomeContent {
  cover: {
    title: string
    subtitle: string
    delay: number
    slides: StructuredImage[]
  }
  pictureRows: HomePictureRow[]
  works: WorksCard[]
  actions: HomeAction[]
  quote: string[]
}

export interface SiteLogoData {
  src: string
  alt: string
  maxWidth: number
  maxHeight: number
}

export interface WorksContent {
  cards: WorksCard[]
  quote: string[]
}

export interface ContactsContent {
  image: StructuredImage
  heading: string
  text: string
  actionHref: string
  actionLabel: string
}
