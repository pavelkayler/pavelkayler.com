import type { GeneratedPage } from '../generated/pages'

const SITE_ORIGIN = 'https://pavelkayler.com'
const SITE_NAME = 'Pavel Kayler | Photographer'
const ROBOTS = 'follow, index, max-snippet:-1, max-video-preview:-1, max-image-preview:large'

function canonicalUrl(page: GeneratedPage) {
  if (page.path === '/') return `${SITE_ORIGIN}/`
  return `${SITE_ORIGIN}${page.path.replace(/\/+$/, '')}/`
}

function socialImageUrl(page: GeneratedPage) {
  if (!page.socialImage) return ''
  return `${SITE_ORIGIN}${page.socialImage.startsWith('/') ? page.socialImage : `/${page.socialImage}`}`
}

function upsertMeta(attribute: 'name' | 'property', key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`)
  if (!element) {
    element = document.createElement('meta')
    element.setAttribute(attribute, key)
    document.head.append(element)
  }
  element.content = content
}

function removeMeta(attribute: 'name' | 'property', key: string) {
  document.head.querySelector(`meta[${attribute}="${key}"]`)?.remove()
}

function upsertCanonical(href: string) {
  let element = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (!element) {
    element = document.createElement('link')
    element.rel = 'canonical'
    document.head.append(element)
  }
  element.href = href
}

function upsertStructuredData(page: GeneratedPage, canonical: string) {
  let element = document.head.querySelector<HTMLScriptElement>(
    'script[type="application/ld+json"][data-seo-schema]',
  )
  if (!element) {
    element = document.createElement('script')
    element.type = 'application/ld+json'
    element.dataset.seoSchema = 'true'
    document.head.append(element)
  }

  const schema = page.path === '/'
    ? {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: SITE_NAME,
        url: canonical,
      }
    : {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: page.title,
        description: page.description,
        url: canonical,
        isPartOf: {
          '@type': 'WebSite',
          name: SITE_NAME,
          url: `${SITE_ORIGIN}/`,
        },
      }

  element.textContent = JSON.stringify(schema)
}

export function applyPageMetadata(page: GeneratedPage) {
  const canonical = canonicalUrl(page)
  const socialImage = socialImageUrl(page)

  document.title = page.title
  upsertCanonical(canonical)

  upsertMeta('name', 'description', page.description)
  upsertMeta('name', 'robots', ROBOTS)

  upsertMeta('property', 'og:title', page.title)
  upsertMeta('property', 'og:description', page.description)
  upsertMeta('property', 'og:type', 'website')
  upsertMeta('property', 'og:locale', 'ru_RU')
  upsertMeta('property', 'og:site_name', SITE_NAME)
  upsertMeta('property', 'og:url', canonical)

  upsertMeta('name', 'twitter:card', 'summary_large_image')
  upsertMeta('name', 'twitter:domain', 'pavelkayler.com')
  upsertMeta('name', 'twitter:url', canonical)
  upsertMeta('name', 'twitter:title', page.title)
  upsertMeta('name', 'twitter:description', page.description)

  if (socialImage) {
    upsertMeta('property', 'og:image', socialImage)
    upsertMeta('property', 'vk:image', socialImage)
    upsertMeta('name', 'twitter:image', socialImage)
  } else {
    removeMeta('property', 'og:image')
    removeMeta('property', 'vk:image')
    removeMeta('name', 'twitter:image')
  }

  upsertStructuredData(page, canonical)
}
