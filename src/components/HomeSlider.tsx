import { useEffect, useState } from 'react'
import type { HomeContent } from '../generated/structured'
import { SiteLogo } from './SiteLogo'
import { StructuredImage } from './StructuredImage'

export function HomeSlider({ cover }: { cover: HomeContent['cover'] }) {
  const [active, setActive] = useState(0)

  useEffect(() => {
    if (cover.slides.length < 2) return
    const timer = window.setInterval(() => {
      setActive((current) => (current + 1) % cover.slides.length)
    }, cover.delay)
    return () => window.clearInterval(timer)
  }, [cover.delay, cover.slides.length])

  const scrollDown = () => {
    document.getElementById('home-main')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="cover -center js-cover -fullscreen">
      <div className="slider js-slider -overlay native-home-slider" data-delay={cover.delay} data-mode="fill">
        <div className="slider-viewport js-slider-viewport">
          <div className="slides js-slides">
            {cover.slides.map((slide, index) => (
              <div
                className="slide js-slide"
                key={slide.src}
                aria-hidden={index !== active}
                style={{
                  display: 'block',
                  visibility: 'visible',
                  opacity: index === active ? 1 : 0,
                  zIndex: index === active ? 2 : 1,
                  transition: 'opacity 800ms ease',
                  pointerEvents: index === active ? 'auto' : 'none',
                }}
              >
                <StructuredImage
                  image={slide}
                  sizes="100vw"
                  loading={index < 2 ? 'eager' : 'lazy'}
                  fetchPriority={index === 0 ? 'high' : 'auto'}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="cover-wrapper js-cover-wrapper -has-arrows">
        <div className="cover-header -medium">
          <SiteLogo />
        </div>
        <div className="cover-content">
          <h1 className="cover-header -medium">{cover.title}</h1>
          <p>{cover.subtitle}</p>
        </div>
        <div className="cover-aside">
          <button className="cover-down-arrow js-cover-down-arrow" type="button" onClick={scrollDown} aria-label="Прокрутить вниз" />
        </div>
      </div>
    </div>
  )
}
