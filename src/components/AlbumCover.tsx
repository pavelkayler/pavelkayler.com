import { useEffect, useLayoutEffect, useRef, useSyncExternalStore } from 'react'
import type { AlbumCover as AlbumCoverData } from '../content/types'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'
import { resolveAsset } from '../app/imageResources'
import { preparedVideo } from '../app/videoResources'
import { preparedPoster } from '../app/coverPosters'
import { getInitialPhase, subscribeInitialPhase } from '../app/siteLoading'
import { LogoSpacer } from './LogoSpacer'

export function AlbumCover({ cover }: { cover: AlbumCoverData }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const reducedMotion = usePrefersReducedMotion()
  const phase = useSyncExternalStore(subscribeInitialPhase, getInitialPhase)
  useLayoutEffect(() => {
    const host = hostRef.current
    if (!host || !cover.videoSrc) return
    const video = phase !== 'loading' ? (preparedVideo(cover.videoSrc) || document.createElement('video')) : document.createElement('video')
    video.muted = video.defaultMuted = true
    video.loop = video.playsInline = true
    if (cover.poster) {
      const poster = preparedPoster(cover.poster) || resolveAsset(cover.poster)
      if (video.poster !== poster) video.poster = poster
    }
    // A deliberately partial entry keeps a native fallback. Successful entry reuses
    // the very same decoder/buffer prepared before the initial loader disappeared.
    if (phase === 'degraded' && !preparedVideo(cover.videoSrc)) { video.src = resolveAsset(cover.videoSrc); video.preload = 'auto' }
    videoRef.current = video
    host.replaceChildren(video)
    return () => { video.pause(); video.remove(); videoRef.current = null }
  }, [cover.videoSrc, cover.poster, phase])
  useEffect(() => {
    const video = videoRef.current
    if (!video || phase === 'loading') return
    if (reducedMotion) { video.pause(); return }
    void video.play().catch(() => undefined)
  }, [phase, reducedMotion])
  return (
    <div className="cover -bottom js-cover">
      {cover.videoSrc && <div ref={hostRef} className="background-video cover-video -overlay" />}
      <div className="cover-wrapper js-cover-wrapper">
        <LogoSpacer coverSize="small" />
        <div className="cover-content"><h1 className="cover-header -small">{cover.title}</h1></div>
        <div className="cover-aside" />
      </div>
    </div>
  )
}
