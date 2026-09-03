import { useLayoutEffect } from 'react'
import { Link } from 'react-router-dom'
import { applyNotFoundMetadata } from '../app/seo'
import { LogoSpacer } from '../components/LogoSpacer'
import { usePageMeta } from '../hooks/usePageMeta'

export function NotFoundPage() {
  usePageMeta('works')

  useLayoutEffect(() => {
    applyNotFoundMetadata()
  }, [])

  return (
    <div className="react-route native-react-page">
      <main className="page-main sections-page js-main">
        <LogoSpacer />
        <div className="sections-container -medium-width -top-align -theme-pad-before -theme-pad-after -background-default -visible">
          <div className="sections-container-inner">
            <div className="row">
              <div className="col-sm-12 col-lg-6 col-lg-offset-3">
                <section className="section-container text-section -default wysiwyg">
                  <h1 style={{ textAlign: 'center' }}>404</h1>
                  <p style={{ textAlign: 'center' }}>Страница не найдена</p>
                </section>
                <section className="section-container action-section -outline -center -full">
                  <Link className="button -outline" to="/works" viewTransition>
                    WORKS
                  </Link>
                </section>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
