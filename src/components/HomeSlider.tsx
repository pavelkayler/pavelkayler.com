import { useEffect, useState, useSyncExternalStore } from 'react'
import { getInitialPhase, subscribeInitialPhase } from '../app/siteLoading'
import { imageUrl, requestImage, subscribeViewport, viewportSnapshot } from '../app/imageResources'
import type { HomeContent } from '../content/types'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'
import { LogoSpacer } from './LogoSpacer'
import { SiteLogo } from './SiteLogo'
import { StructuredImage } from './StructuredImage'

export function HomeSlider({ cover }: { cover: HomeContent['cover'] }) {
  const [active, setActive] = useState(0)
  const [warmed, setWarmed] = useState(() => new Set([0]))
  const reducedMotion = usePrefersReducedMotion()
  const phase = useSyncExternalStore(subscribeInitialPhase, getInitialPhase)
  const viewport = useSyncExternalStore(subscribeViewport, viewportSnapshot)
  useEffect(() => {
    if (phase === 'loading' || reducedMotion || cover.slides.length < 2) return
    let cancelled = false
    const next = (active + 1) % cover.slides.length
    let pending: Promise<boolean> | null = null

    const warmNext = () => {
      if (pending) return pending
      pending = requestImage(imageUrl({ ...cover.slides[next], sizes: '100vw' }), 20, true, true)
        .then(() => {
          if (!cancelled) setWarmed(current => new Set([...current, next]))
          return true
        }, () => false)
      return pending
    }

    // Do not immediately decode a large next hero while the visitor is most likely
    // to choose a section. Start close to the scheduled slide change instead.
    const warmDelay = Math.max(1000, cover.delay - 1000)
    const warmTimer = window.setTimeout(() => { void warmNext() }, warmDelay)
    const advanceTimer = window.setTimeout(() => {
      void warmNext().then(ready => { if (ready && !cancelled) setActive(next) })
    }, cover.delay)

    return () => {
      cancelled = true
      window.clearTimeout(warmTimer)
      window.clearTimeout(advanceTimer)
    }
  }, [active, cover.delay, cover.slides, reducedMotion, phase, viewport])
  const scrollDown = () => document.getElementById('home-main')?.scrollIntoView({
    behavior: reducedMotion ? 'auto' : 'smooth', block: 'start',
  })
  return (
    <div className="cover -center js-cover -fullscreen">
      <div className="slider js-slider -overlay native-home-slider" data-delay={cover.delay} data-mode="fill">
        <div className="slider-viewport js-slider-viewport"><div className="slides js-slides">
          {cover.slides.map((slide, index) => (
            <div className="slide js-slide" key={slide.src} aria-hidden={index !== active}
              style={{ display: 'block', visibility: 'visible', opacity: index === active ? 1 : 0,
                zIndex: index === active ? 2 : 1, transition: reducedMotion ? 'none' : 'opacity 800ms ease',
                pointerEvents: index === active ? 'auto' : 'none' }}>
              {warmed.has(index) && <StructuredImage image={slide} sizes="100vw" loading="eager"
                fetchPriority={index === 0 ? 'high' : 'low'} />}
            </div>
          ))}
        </div></div>
      </div>
      <div className="cover-wrapper js-cover-wrapper -has-arrows">
        <LogoSpacer coverSize="medium" />
        <div className="cover-content">
          <div className="home-hero-copy">
            <div className="home-site-logo"><SiteLogo /></div>
            <h1 className="cover-header -medium">{cover.title}</h1><p>{cover.subtitle}</p>
          </div>
        </div>
        <div className="cover-aside">
          <button className="cover-down-arrow js-cover-down-arrow" type="button" onClick={scrollDown} aria-label="Прокрутить вниз" />
        </div>
      </div>
    </div>
  )
}
