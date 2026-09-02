import { Link } from 'react-router-dom'
import { worksContent } from '../generated/structured'
import { prefetchRoute } from '../app/prefetch'
import { SiteLogo } from '../components/SiteLogo'
import { StructuredImage } from '../components/StructuredImage'
import { usePageMeta } from '../hooks/usePageMeta'

export function WorksPage() {
  usePageMeta('works')

  return (
    <div className="react-route native-react-page">
      <main className="page-main js-main">
        <SiteLogo />

        <div className="sections-container -small-pad-before -small-pad-after -full-width -visible">
          <div className="sections-container-inner">
            <div className="section-container">
              <div className="listing js-listing" data-format="portrait" data-hover="underline">
                {worksContent.cards.map((card) => {
                  const warm = () => prefetchRoute(card.to)
                  return (
                    <div className="listing-item js-listing-item" key={card.to}>
                      <Link
                        className="listing-link"
                        to={card.to}
                        onPointerEnter={warm}
                        onFocus={warm}
                        onPointerDown={warm}
                      >
                        <StructuredImage
                          image={card.image}
                          sizes="(max-width: 768px) 100vw, 33vw"
                        />
                        <div className="listing-caption">
                          <div className="listing-title"><span>{card.title}</span></div>
                        </div>
                      </Link>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="sections-container -small-pad-before -small-pad-after -listing-postfix -medium-width -visible">
          <div className="sections-container-inner">
            <div className="section-container text-section wysiwyg">
              <blockquote>
                {worksContent.quote.map((line) => (
                  <p style={{ textAlign: 'right' }} key={line}>{line}</p>
                ))}
              </blockquote>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
