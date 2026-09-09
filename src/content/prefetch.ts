// Maintained site content. Update paths and dimensions together.
import type { PageKey } from './page-metadata'
export interface PrefetchImageSpec { src: string; srcSet: string; sizes: string }
export const routePrefetch: Record<PageKey, PrefetchImageSpec[]> = {
  "home": [
    {
      "src": "__BASE__media/images/home/hero-slide-01-1280x720.png",
      "srcSet": "__BASE__media/images/home/hero-slide-01-640x360.png 600w, __BASE__media/images/home/hero-slide-01-1280x720.png 1240w, __BASE__media/images/home/hero-slide-01-1920x1080.png 1880w",
      "sizes": "100vw"
    },
    {
      "src": "__BASE__media/images/home/hero-slide-02-1280x851.jpg",
      "srcSet": "__BASE__media/images/home/hero-slide-02-640x425.jpg 600w, __BASE__media/images/home/hero-slide-02-1280x851.jpg 1240w, __BASE__media/images/home/hero-slide-02-1920x1276.jpg 1880w, __BASE__media/images/home/hero-slide-02-2560x1701.jpg 2520w",
      "sizes": "100vw"
    },
    {
      "src": "__BASE__media/images/home/hero-slide-03-1280x851.jpg",
      "srcSet": "__BASE__media/images/home/hero-slide-03-640x425.jpg 600w, __BASE__media/images/home/hero-slide-03-1280x851.jpg 1240w, __BASE__media/images/home/hero-slide-03-1920x1276.jpg 1880w, __BASE__media/images/home/hero-slide-03-2560x1701.jpg 2520w",
      "sizes": "100vw"
    },
    {
      "src": "__BASE__media/images/home/hero-slide-04-1280x875.jpg",
      "srcSet": "__BASE__media/images/home/hero-slide-04-640x437.jpg 600w, __BASE__media/images/home/hero-slide-04-1280x875.jpg 1240w, __BASE__media/images/home/hero-slide-04-1920x1312.jpg 1880w, __BASE__media/images/home/hero-slide-04-2560x1749.jpg 2520w",
      "sizes": "100vw"
    },
    {
      "src": "__BASE__media/images/home/hero-slide-05-1280x1280.jpg",
      "srcSet": "__BASE__media/images/home/hero-slide-05-640x640.jpg 600w, __BASE__media/images/home/hero-slide-05-1280x1280.jpg 1240w, __BASE__media/images/home/hero-slide-05-1920x1920.jpg 1880w, __BASE__media/images/home/hero-slide-05-2560x2560.jpg 2520w",
      "sizes": "100vw"
    },
    {
      "src": "__BASE__media/images/home/home-photo-01-1280x1919.jpg",
      "srcSet": "__BASE__media/images/home/home-photo-01-640x960.jpg 640w, __BASE__media/images/home/home-photo-01-1280x1919.jpg 1280w, __BASE__media/images/home/home-photo-01-1920x2879.jpg 1920w, __BASE__media/images/home/home-photo-01-2174x3259.jpg 2174w",
      "sizes": "(max-width: 768px) 100vw, 50vw"
    }
  ],
  "works": [
    {
      "src": "__BASE__media/images/navigation/portraits-category-card-1280x1920.jpg",
      "srcSet": "__BASE__media/images/navigation/portraits-category-card-640x960.jpg 600w, __BASE__media/images/navigation/portraits-category-card-1280x1920.jpg 1240w, __BASE__media/images/navigation/portraits-category-card-1920x2880.jpg 1880w",
      "sizes": "(max-width: 768px) 100vw, 33vw"
    },
    {
      "src": "__BASE__media/images/navigation/projects-category-card-1280x1920.jpg",
      "srcSet": "__BASE__media/images/navigation/projects-category-card-640x960.jpg 600w, __BASE__media/images/navigation/projects-category-card-1280x1920.jpg 1240w, __BASE__media/images/navigation/projects-category-card-1920x2880.jpg 1880w",
      "sizes": "(max-width: 768px) 100vw, 33vw"
    },
    {
      "src": "__BASE__media/images/navigation/brands-category-card-1280x1920.jpg",
      "srcSet": "__BASE__media/images/navigation/brands-category-card-640x960.jpg 600w, __BASE__media/images/navigation/brands-category-card-1280x1920.jpg 1240w, __BASE__media/images/navigation/brands-category-card-1920x2880.jpg 1880w",
      "sizes": "(max-width: 768px) 100vw, 33vw"
    }
  ],
  "portraits": [
    {
      "src": "__BASE__media/images/portraits/portraits-cover-poster-464x848.jpg",
      "srcSet": "",
      "sizes": "100vw"
    },
    {
      "src": "__BASE__media/images/portraits/portraits-photo-001-1280x1824.jpg",
      "srcSet": "__BASE__media/images/portraits/portraits-photo-001-640x912.jpg 600w, __BASE__media/images/portraits/portraits-photo-001-1280x1824.jpg 1240w, __BASE__media/images/portraits/portraits-photo-001-1920x2735.jpg 1880w",
      "sizes": "(max-width: 768px) 50vw, 33vw"
    },
    {
      "src": "__BASE__media/images/portraits/portraits-photo-002-1280x2276.jpg",
      "srcSet": "__BASE__media/images/portraits/portraits-photo-002-640x1138.jpg 600w, __BASE__media/images/portraits/portraits-photo-002-1280x2276.jpg 1240w, __BASE__media/images/portraits/portraits-photo-002-1920x3413.jpg 1880w",
      "sizes": "(max-width: 768px) 50vw, 33vw"
    },
    {
      "src": "__BASE__media/images/portraits/portraits-photo-003-1280x838.jpg",
      "srcSet": "__BASE__media/images/portraits/portraits-photo-003-640x419.jpg 600w, __BASE__media/images/portraits/portraits-photo-003-1280x838.jpg 1240w, __BASE__media/images/portraits/portraits-photo-003-1920x1257.jpg 1880w",
      "sizes": "(max-width: 768px) 50vw, 33vw"
    },
    {
      "src": "__BASE__media/images/portraits/portraits-photo-004-1280x2524.jpg",
      "srcSet": "__BASE__media/images/portraits/portraits-photo-004-640x1262.jpg 600w, __BASE__media/images/portraits/portraits-photo-004-1280x2524.jpg 1240w, __BASE__media/images/portraits/portraits-photo-004-1920x3786.jpg 1880w",
      "sizes": "(max-width: 768px) 50vw, 33vw"
    },
    {
      "src": "__BASE__media/images/portraits/portraits-photo-005-1280x2802.jpg",
      "srcSet": "__BASE__media/images/portraits/portraits-photo-005-640x1401.jpg 600w, __BASE__media/images/portraits/portraits-photo-005-1280x2802.jpg 1240w, __BASE__media/images/portraits/portraits-photo-005-1871x4096.jpg 1880w",
      "sizes": "(max-width: 768px) 50vw, 33vw"
    }
  ],
  "projects": [
    {
      "src": "__BASE__media/images/projects/projects-cover-poster-1920x1080.jpg",
      "srcSet": "",
      "sizes": "100vw"
    },
    {
      "src": "__BASE__media/images/projects/projects-photo-001-1280x1856.jpg",
      "srcSet": "__BASE__media/images/projects/projects-photo-001-640x928.jpg 600w, __BASE__media/images/projects/projects-photo-001-1280x1856.jpg 1240w, __BASE__media/images/projects/projects-photo-001-1920x2784.jpg 1880w",
      "sizes": "(max-width: 768px) 50vw, 33vw"
    },
    {
      "src": "__BASE__media/images/projects/projects-photo-002-1280x1280.jpg",
      "srcSet": "__BASE__media/images/projects/projects-photo-002-640x640.jpg 600w, __BASE__media/images/projects/projects-photo-002-1280x1280.jpg 1240w, __BASE__media/images/projects/projects-photo-002-1920x1920.jpg 1880w",
      "sizes": "(max-width: 768px) 50vw, 33vw"
    },
    {
      "src": "__BASE__media/images/projects/projects-photo-003-1280x2016.jpg",
      "srcSet": "__BASE__media/images/projects/projects-photo-003-640x1008.jpg 600w, __BASE__media/images/projects/projects-photo-003-1280x2016.jpg 1240w, __BASE__media/images/projects/projects-photo-003-1920x3025.jpg 1880w",
      "sizes": "(max-width: 768px) 50vw, 33vw"
    },
    {
      "src": "__BASE__media/images/projects/projects-photo-004-1280x1044.jpg",
      "srcSet": "__BASE__media/images/projects/projects-photo-004-640x522.jpg 600w, __BASE__media/images/projects/projects-photo-004-1280x1044.jpg 1240w, __BASE__media/images/projects/projects-photo-004-1920x1566.jpg 1880w",
      "sizes": "(max-width: 768px) 50vw, 33vw"
    },
    {
      "src": "__BASE__media/images/projects/projects-photo-005-1280x1104.jpg",
      "srcSet": "__BASE__media/images/projects/projects-photo-005-640x552.jpg 600w, __BASE__media/images/projects/projects-photo-005-1280x1104.jpg 1240w, __BASE__media/images/projects/projects-photo-005-1920x1657.jpg 1880w",
      "sizes": "(max-width: 768px) 50vw, 33vw"
    }
  ],
  "brands": [
    {
      "src": "__BASE__media/images/brands/brands-photo-001-1280x1280.jpg",
      "srcSet": "__BASE__media/images/brands/brands-photo-001-640x640.jpg 600w, __BASE__media/images/brands/brands-photo-001-1280x1280.jpg 1240w, __BASE__media/images/brands/brands-photo-001-1920x1920.jpg 1880w",
      "sizes": "(max-width: 768px) 50vw, 33vw"
    },
    {
      "src": "__BASE__media/images/brands/brands-photo-002-1280x2269.jpg",
      "srcSet": "__BASE__media/images/brands/brands-photo-002-640x1134.jpg 600w, __BASE__media/images/brands/brands-photo-002-1280x2269.jpg 1240w, __BASE__media/images/brands/brands-photo-002-1920x3403.jpg 1880w",
      "sizes": "(max-width: 768px) 50vw, 33vw"
    },
    {
      "src": "__BASE__media/images/brands/brands-photo-003-1280x1280.jpg",
      "srcSet": "__BASE__media/images/brands/brands-photo-003-640x640.jpg 600w, __BASE__media/images/brands/brands-photo-003-1280x1280.jpg 1240w, __BASE__media/images/brands/brands-photo-003-1920x1920.jpg 1880w",
      "sizes": "(max-width: 768px) 50vw, 33vw"
    },
    {
      "src": "__BASE__media/images/brands/brands-photo-004-1280x1280.jpg",
      "srcSet": "__BASE__media/images/brands/brands-photo-004-640x640.jpg 600w, __BASE__media/images/brands/brands-photo-004-1280x1280.jpg 1240w, __BASE__media/images/brands/brands-photo-004-1920x1920.jpg 1880w",
      "sizes": "(max-width: 768px) 50vw, 33vw"
    },
    {
      "src": "__BASE__media/images/brands/brands-photo-005-1280x1280.jpg",
      "srcSet": "__BASE__media/images/brands/brands-photo-005-640x640.jpg 600w, __BASE__media/images/brands/brands-photo-005-1280x1280.jpg 1240w, __BASE__media/images/brands/brands-photo-005-1920x1920.jpg 1880w",
      "sizes": "(max-width: 768px) 50vw, 33vw"
    },
    {
      "src": "__BASE__media/images/brands/brands-photo-006-1280x1280.jpg",
      "srcSet": "__BASE__media/images/brands/brands-photo-006-640x640.jpg 600w, __BASE__media/images/brands/brands-photo-006-1280x1280.jpg 1240w, __BASE__media/images/brands/brands-photo-006-1920x1920.jpg 1880w",
      "sizes": "(max-width: 768px) 50vw, 33vw"
    }
  ],
  "contacts": [
    {
      "src": "__BASE__media/images/contacts/photographer-portrait-1280x1281.jpg",
      "srcSet": "__BASE__media/images/contacts/photographer-portrait-640x641.jpg 640w, __BASE__media/images/contacts/photographer-portrait-1280x1281.jpg 1280w, __BASE__media/images/contacts/photographer-portrait-1920x1921.jpg 1920w",
      "sizes": "(max-width: 768px) 100vw, 33vw"
    }
  ]
}
