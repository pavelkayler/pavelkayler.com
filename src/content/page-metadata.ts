// Maintained site content. Update paths and dimensions together.
export type PageKey = 'home' | 'works' | 'portraits' | 'projects' | 'brands' | 'contacts'
export interface PageMetadata {
  key: PageKey
  path: string
  title: string
  description: string
  socialImage: string
  bodyClass: string
  hasCover: boolean
}
export const pages: Record<PageKey, PageMetadata> = {
  "home": {
    "key": "home",
    "path": "/",
    "title": "Pavel Kayler | Photographer",
    "description": "Павел Кайлер. Фотограф, специализирующийся на портретных кадрах, наполненных чувством одиночества и созерцания.",
    "socialImage": "/assets/social/home.png",
    "bodyClass": "theme-polina -has-cover -color-scheme -scheme-dark -accented uc-page-type-page",
    "hasCover": true
  },
  "works": {
    "key": "works",
    "path": "/works",
    "title": "ПОРТФОЛИО | PAVEL KAYLER",
    "description": "Откройте портфолио Павла Кайлер, где представлены лучшие работы в жанре портретной фотографии, видеосъемки и художественных проектов, выполненные с высоким вниманием к стилю и деталям.",
    "socialImage": "/assets/social/works.png",
    "bodyClass": "theme-polina -color-scheme -scheme-dark -accented uc-page-type-listing",
    "hasCover": false
  },
  "portraits": {
    "key": "portraits",
    "path": "/portraits",
    "title": "ПОРТРЕТЫ | PAVEL KAYLER",
    "description": "Посмотрите портреты, созданные Павлом Кайлер. Каждый снимок — это результат тщательной работы по постановке поз, подбору образов и созданию атмосферы для естественного и стильного образа.",
    "socialImage": "/assets/social/portraits.jpg",
    "bodyClass": "theme-polina -has-cover -color-scheme -scheme-dark -accented uc-page-type-album",
    "hasCover": true
  },
  "projects": {
    "key": "projects",
    "path": "/projects",
    "title": "ПРОЕКТЫ | PAVEL KAYLER",
    "description": "В этой галерее представлены кадры с различных проектов, над которыми работал Павел Кайлер. Каждый снимок отражает профессиональный подход и внимание к деталям, независимо от жанра или масштаба проекта.",
    "socialImage": "/assets/social/projects.jpg",
    "bodyClass": "theme-polina -has-cover -color-scheme -scheme-dark -accented uc-page-type-album",
    "hasCover": true
  },
  "brands": {
    "key": "brands",
    "path": "/brands",
    "title": "БРЕНДЫ | PAVEL KAYLER",
    "description": "Коммерческие и имиджевые съемки для брендов в портфолио Павла Кайлера: визуальные истории, портреты и проекты с вниманием к стилю и деталям.",
    "socialImage": "/assets/social/brands.jpg",
    "bodyClass": "theme-polina -color-scheme -scheme-dark -accented uc-page-type-album",
    "hasCover": false
  },
  "contacts": {
    "key": "contacts",
    "path": "/contacts",
    "title": "КОНТАКТЫ | PAVEL KAYLER",
    "description": "Свяжитесь с Павлом Кайлер для бронирования фотосессий или обсуждения ваших проектов. Здесь вы найдете контактные данные и формы для отправки сообщений.",
    "socialImage": "/assets/social/contacts.png",
    "bodyClass": "theme-polina -color-scheme -scheme-dark -accented uc-page-type-page",
    "hasCover": false
  }
}
