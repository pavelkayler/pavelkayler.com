import { useEffect, useRef, useSyncExternalStore } from 'react'
import type { AlbumCover as AlbumCoverData } from '../content/types'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'
import { resolveAsset, preparedVideoUrl } from '../app/imageResources'
import { getInitialPhase, subscribeInitialPhase } from '../app/siteLoading'
import { LogoSpacer } from './LogoSpacer'

export function AlbumCover({ cover }: { cover: AlbumCoverData }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const reducedMotion = usePrefersReducedMotion()
  const phase = useSyncExternalStore(subscribeInitialPhase, getInitialPhase)
  const src = cover.videoSrc && phase !== 'loading'
    ? (preparedVideoUrl(cover.videoSrc) || resolveAsset(cover.videoSrc)) : undefined
  useEffect(() => {
    const video = videoRef.current
    if (!video || !src) return
    if (reducedMotion) { video.pause(); return }
    void video.play().catch(() => undefined)
  }, [src, reducedMotion])
  return (
    <div className="cover -bottom js-cover">
      {cover.videoSrc && <div className="background-video cover-video -overlay">
        <video ref={videoRef} src={src} autoPlay={!reducedMotion && Boolean(src)} loop muted playsInline
          poster={cover.poster ? resolveAsset(cover.poster) : undefined} preload={src ? 'auto' : 'none'} />
      </div>}
      <div className="cover-wrapper js-cover-wrapper">
        <LogoSpacer coverSize="small" />
        <div className="cover-content"><h1 className="cover-header -small">{cover.title}</h1></div>
        <div className="cover-aside" />
      </div>
    </div>
  )
}
