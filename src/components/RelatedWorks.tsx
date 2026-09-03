import { Link } from 'react-router-dom'
import { prefetchRoute } from '../app/prefetch'
import type { WorksCard } from '../content/types'
import { StructuredImage } from './StructuredImage'

export function RelatedWorks({ cards }: { cards: WorksCard[] | readonly WorksCard[] }) {
  if (!cards.length) return null

  return (
    <>
      <div className="sections-container -large-pad-before -small-pad-after -labeled-divider -full-width -visible">
        <div className="sections-container-inner">
          <div className="section-container labeled-divider-section">
            <h2 className="label">WORKS</h2>
          </div>
        </div>
      </div>

      <div className="sections-container -small-pad-before -small-pad-after -full-width -visible">
        <div className="sections-container-inner">
          <div className="section-container">
            <div className="listing js-listing" data-format="portrait" data-hover="underline">
              {cards.map((card) => {
                const warm = () => prefetchRoute(card.to)
                return (
                  <div className="listing-item js-listing-item" key={card.to}>
                    <Link
                      className="listing-link"
                      to={card.to}
                      viewTransition
                      onPointerEnter={warm}
                      onFocus={warm}
                      onPointerDown={warm}
                    >
                      <StructuredImage image={card.image} sizes="(max-width: 768px) 100vw, 50vw" />
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
    </>
  )
}
