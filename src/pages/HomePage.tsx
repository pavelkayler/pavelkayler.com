import { Link } from 'react-router-dom'
import { homeContent } from '../generated/content/home'
import { prefetchRoute } from '../app/prefetch'
import { HomeSlider } from '../components/HomeSlider'
import { StructuredImage } from '../components/StructuredImage'
import { usePageMeta } from '../hooks/usePageMeta'

export function HomePage() {
  usePageMeta('home')

  return (
    <div className="react-route native-react-page">
      <HomeSlider cover={homeContent.cover} />

      <main className="page-main sections-page js-main" id="home-main">
        {homeContent.pictureRows.map((row, rowIndex) => (
          <div className={`${row.containerClass} -visible`} key={`${row.containerClass}-${rowIndex}`}>
            <div className="sections-container-inner">
              <div className="row">
                {row.columns.map((column, columnIndex) => (
                  <div className={column.columnClass} key={`${rowIndex}-${columnIndex}`}>
                    <section className={column.sectionClass}>
                      <StructuredImage
                        image={column.image}
                        sizes={row.columns.length > 1 ? '(max-width: 768px) 100vw, 50vw' : '100vw'}
                      />
                    </section>
                  </div>
                ))}
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
                  const warm = () => prefetchRoute(card.to)
                  return (
                    <div className="listing-item js-listing-item" key={card.to}>
                      <Link className="listing-link" to={card.to} viewTransition onPointerEnter={warm} onFocus={warm} onPointerDown={warm}>
                        <StructuredImage image={card.image} sizes="(max-width: 768px) 100vw, 33vw" />
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
          </div></div>
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
