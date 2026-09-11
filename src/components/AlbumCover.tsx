import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { AlbumCover as AlbumCoverData } from '../content/types'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'
import { resolveAsset } from '../app/imageResources'
import { observeAhead } from '../app/aheadLoading'
import { getInitialPhase, subscribeInitialPhase } from '../app/siteLoading'
import { LogoSpacer } from './LogoSpacer'

type IdleWindow = Window & typeof globalThis & {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number
  cancelIdleCallback?: (id: number) => void
}

export function AlbumCover({ cover }: { cover: AlbumCoverData }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [near, setNear] = useState(false)
  const [videoArmed, setVideoArmed] = useState(false)
  const reducedMotion = usePrefersReducedMotion()
  const phase = useSyncExternalStore(subscribeInitialPhase, getInitialPhase)

  useEffect(() => {
    if (!hostRef.current) return
    if (!('IntersectionObserver' in window)) { setNear(true); return }
    return observeAhead(hostRef.current, () => setNear(true))
  }, [])

  useEffect(() => {
    setVideoArmed(false)
    if (!near || phase === 'loading' || reducedMotion || !cover.videoSrc) return

    const idleWindow = window as IdleWindow
    let idleId: number | undefined
    const timer = window.setTimeout(() => {
      const arm = () => setVideoArmed(true)
      if (idleWindow.requestIdleCallback) idleId = idleWindow.requestIdleCallback(arm, { timeout: 900 })
      else arm()
    }, 750)

    return () => {
      window.clearTimeout(timer)
      if (idleId !== undefined) idleWindow.cancelIdleCallback?.(idleId)
    }
  }, [near, phase, reducedMotion, cover.videoSrc])

  const enabled = videoArmed && near && phase !== 'loading' && !reducedMotion
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (!enabled) { video.pause(); return }
    void video.play().catch(() => undefined)
  }, [enabled, cover.videoSrc])

  return (
    <div className="cover -bottom js-cover">
      {cover.videoSrc && <div ref={hostRef} className="background-video cover-video -overlay" data-video-state={enabled ? 'playing' : 'poster'}>
        <video ref={videoRef} muted loop playsInline autoPlay={enabled} preload="none"
          src={enabled ? resolveAsset(cover.videoSrc) : undefined}
          poster={cover.poster ? resolveAsset(cover.poster) : undefined} />
      </div>}
      <div className="cover-wrapper js-cover-wrapper">
        <LogoSpacer coverSize="small" />
        <div className="cover-content"><h1 className="cover-header -small">{cover.title}</h1></div>
        <div className="cover-aside" />
      </div>
    </div>
  )
}
