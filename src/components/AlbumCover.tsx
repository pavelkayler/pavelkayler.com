import type { AlbumCover as AlbumCoverData } from '../content/types'
import { resolveAsset } from './StructuredImage'
import { LogoSpacer } from './LogoSpacer'

export function AlbumCover({ cover }: { cover: AlbumCoverData }) {
  return (
    <div className="cover -bottom js-cover">
      {cover.videoSrc && (
        <div className="background-video cover-video -overlay">
          <video
            autoPlay
            loop
            muted
            playsInline
            poster={cover.poster ? resolveAsset(cover.poster) : undefined}
            preload="metadata"
          >
            <source src={resolveAsset(cover.videoSrc)} />
          </video>
        </div>
      )}

      <div className="cover-wrapper js-cover-wrapper">
        <LogoSpacer coverSize="small" />
        <div className="cover-content">
          <h1 className="cover-header -small">{cover.title}</h1>
        </div>
        <div className="cover-aside" />
      </div>
    </div>
  )
}
