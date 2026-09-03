import type { AlbumContent } from '../content/types'
import { AlbumCover } from '../components/AlbumCover'
import { NativeGallery } from '../components/NativeGallery'
import { RelatedWorks } from '../components/RelatedWorks'
import { LogoSpacer } from '../components/LogoSpacer'
import { usePageMeta } from '../hooks/usePageMeta'

export type AlbumPageKey = 'portraits' | 'projects' | 'brands'

export function GalleryPage({ pageKey, album }: { pageKey: AlbumPageKey; album: AlbumContent }) {
  const page = usePageMeta(pageKey)

  return (
    <div className="react-route native-react-page">
      {album.cover && <AlbumCover cover={album.cover} />}

      <main className="page-main js-main">
        {!album.cover && (
          <>
            <LogoSpacer />
            <h1 className="visually-hidden">{page.title}</h1>
          </>
        )}

        <div className="sections-container -small-pad-before -small-pad-after -medium-width -visible">
          <div className="sections-container-inner">
            <div className="section-container">
              <NativeGallery photos={album.photos} prioritizeFirst={!album.cover} />
            </div>
          </div>
        </div>

        {album.quote.length > 0 && (
          <div className="sections-container -small-pad-before -small-pad-after -album-postfix -medium-width -visible">
            <div className="sections-container-inner"><div className="section-container text-section wysiwyg">
              <blockquote>{album.quote.map((line) => <p style={{ textAlign: 'right' }} key={line}>{line}</p>)}</blockquote>
            </div></div>
          </div>
        )}

        <RelatedWorks cards={album.related} />
      </main>
    </div>
  )
}
