import { Link } from 'react-router-dom'
import { siteLogo } from '../generated/content/site'
import { resolveAsset } from './StructuredImage'

export function SiteLogo() {
  return (
    <div className="logo js-logo -visible">
      <Link className="logo-link" title="pavelkayler.com" to="/" viewTransition>
        <span className="logo-with-placeholder -light-logo" style={{ maxWidth: siteLogo.maxWidth }}>
          <canvas
            className="logo-placeholder"
            width={968}
            height={162}
            style={{ maxWidth: siteLogo.maxWidth, maxHeight: siteLogo.maxHeight }}
          />
          <img
            alt={siteLogo.alt}
            className="logo-image"
            src={resolveAsset(siteLogo.src)}
            width={968}
            height={162}
            style={{ maxHeight: siteLogo.maxHeight }}
            decoding="async"
          />
        </span>
      </Link>
    </div>
  )
}
