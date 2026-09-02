import { contactsContent } from '../generated/content/contacts'
import { LogoSpacer } from '../components/LogoSpacer'
import { StructuredImage } from '../components/StructuredImage'
import { usePageMeta } from '../hooks/usePageMeta'

export function ContactsPage() {
  usePageMeta('contacts')

  return (
    <div className="react-route native-react-page">
      <main className="page-main sections-page js-main">
        <LogoSpacer />

        <div className="sections-container -medium-width -middle-align -theme-pad-before -small-pad-after -background-default -visible">
          <div className="sections-container-inner"><div className="row">
            <div className="col-sm-12 col-md-4" />
            <div className="col-sm-12 col-md-4">
              <section className="section-container picture-section -default -square">
                <StructuredImage image={contactsContent.image} sizes="(max-width: 768px) 100vw, 33vw" loading="eager" fetchPriority="high" />
              </section>
            </div>
            <div className="col-sm-12 col-md-4" />
          </div></div>
        </div>

        <div className="sections-container -medium-width -top-align -small-pad-before -small-pad-after -background-default -visible">
          <div className="sections-container-inner"><div className="row"><div className="col-sm-12 col-lg-6 col-lg-offset-3">
            <section className="section-container text-section -default wysiwyg">
              <h1 style={{ textAlign: 'center' }}>{contactsContent.heading}</h1>
              <p style={{ textAlign: 'center' }}>{contactsContent.text}</p>
            </section>
          </div></div></div>
        </div>

        <div className="sections-container -medium-width -top-align -small-pad-before -theme-pad-after -background-default -visible">
          <div className="sections-container-inner"><div className="row"><div className="col-sm-12 col-lg-6 col-lg-offset-3">
            <section className="section-container action-section -outline -center -full">
              <a className="button -outline" href={contactsContent.actionHref}>
                <i className="fab fa-telegram-plane" aria-hidden="true" />
                {contactsContent.actionLabel}
              </a>
            </section>
          </div></div></div>
        </div>
      </main>
    </div>
  )
}
