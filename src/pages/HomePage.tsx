import { Link } from 'react-router-dom'
import { homeContent } from '../content/pages/home'
import type { StructuredImage as ImageData } from '../content/types'
import { prefetchRoute } from '../app/prefetch'
import { HomeSlider } from '../components/HomeSlider'
import { resolveAsset, StructuredImage } from '../components/StructuredImage'
import { useHomePhotoGallery } from '../hooks/useHomePhotoGallery'
import { usePageMeta } from '../hooks/usePageMeta'

function fullscreenImage(image: ImageData) {
  // Use the largest already-published variant, not the 1280px thumbnail default.
  // The frozen homepage srcsets use width descriptors and one aspect ratio.
  const candidates = image.srcSet.split(',').flatMap((candidate) => {
    const match = candidate.trim().match(/^(\S+)\s+([1-9]\d*)w$/)
    return match ? [{ src: match[1], width: Number(match[2]) }] : []
  })
  const largest = candidates.sort((a, b) => b.width - a.width)[0]
  const width = largest?.width ?? image.width
  return {
    src: resolveAsset(largest?.src ?? image.src),
    width,
    height: Math.round(image.height * width / image.width),
    srcSet: image.srcSet ? resolveAsset(image.srcSet) : undefined,
  }
}

export function HomePage() {
  usePageMeta('home')
  const galleryRef = useHomePhotoGallery()

  return (
    <div className="react-route native-react-page">
      <HomeSlider cover={homeContent.cover} />

      <main ref={galleryRef} className="page-main sections-page js-main" id="home-main">
        {homeContent.pictureRows.map((row, rowIndex) => (
          <div className={`${row.containerClass} -visible`} key={`${row.containerClass}-${rowIndex}`}>
            <div className="sections-container-inner">
              <div className="row">
                {row.columns.map((column, columnIndex) => {
                  const fullscreen = fullscreenImage(column.image)
                  return (
                    <div className={column.columnClass} key={`${rowIndex}-${columnIndex}`}>
                      <section className={column.sectionClass}>
                        <a
                          className="home-gallery-link"
                          href={fullscreen.src}
                          data-pswp-width={fullscreen.width}
                          data-pswp-height={fullscreen.height}
                          data-pswp-srcset={fullscreen.srcSet}
                          aria-haspopup="dialog"
                          aria-label="Открыть фотографию"
                          style={{ display: 'block', width: '100%', cursor: 'zoom-in' }}
                        >
                          <StructuredImage
                            image={column.image}
                            loading="lazy"
                            sizes={row.columns.length > 1 ? '(max-width: 768px) 100vw, 50vw' : '100vw'}
                          />
                        </a>
                      </section>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        ))}

        <div className="sections-container -medium-width -top-align -xlarge-pad-before -small-pad-after -background-default -visible">
          <div className="sections-container-inner"><div className="row"><div className="col-sm-12"><section className="section-container divider-section -space -space"><hr /></section></div></div></div>
        </div>

        <div className="sections-container -medium-width -top-align -small-pad-before -small-pad-after -background-default -visible">
          <div className="sections-container-inner"><div className="row"><div className="col-sm-12">
            <section className="section-container inline-listing-section -default">
              <div className="listing js-listing" data-format="portrait" data-hover="underline">
                {homeContent.works.map((card) => {
                  const warm = () => prefetchRoute(card.to, 5)
                  const demand = () => prefetchRoute(card.to, 0)
                  return (
                    <div className="listing-item js-listing-item" key={card.to}>
                      <Link className="listing-link" to={card.to} onPointerEnter={warm} onFocus={warm} onPointerDown={demand}>
                        <StructuredImage image={card.image} loading="lazy" sizes="(max-width: 768px) 100vw, 33vw" />
                        <div className="listing-caption"><div className="listing-title"><span>{card.title}</span></div></div>
                      </Link>
                    </div>
                  )
                })}
              </div>
            </section>
          </div></div></div>
        </div>

        <div className="sections-container -medium-width -top-align -small-pad-before -medium-pad-after -background-default -visible">
          <div className="sections-container-inner"><div className="row">
            {homeContent.actions.map((action) => (
              <div className={action.columnClass} key={action.href}>
                <section className="section-container action-section -outline -center -full">
                  <a className="button -outline" href={action.href}>
                    {action.iconClass && <i className={action.iconClass} aria-hidden="true" />}
                    {action.label}
                  </a>
                </section>
              </div>
            ))}
          </div></div></div>
        </div>

        <div className="sections-container -medium-width -top-align -medium-pad-before -theme-pad-after -background-accent -visible">
          <div className="sections-container-inner"><div className="row"><div className="col-sm-12">
            <section className="section-container text-section -default wysiwyg">
              <blockquote>{homeContent.quote.map((line) => <p style={{ textAlign: 'left' }} key={line}>{line}</p>)}</blockquote>
            </section>
          </div></div></div>
        </div>
      </main>
    </div>
  )
}
