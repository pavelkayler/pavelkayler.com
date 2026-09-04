import { NavLink, useLocation } from 'react-router-dom'
import { prefetchRoute } from '../app/prefetch'

const socials = [
  { href: 'https://t.me/pavelkayler', icon: 'fab fa-telegram-plane', label: 'Telegram' },
  { href: 'https://www.instagram.com/pavelkayler/', icon: 'fab fa-instagram', label: 'Instagram' },
  { href: 'https://vk.com/pavelkayler', icon: 'fab fa-vk', label: 'VK' },
  { href: 'https://www.youtube.com/@pavelkayler', icon: 'fab fa-youtube', label: 'YouTube' },
]

const nav = [
  { to: '/', label: 'HOME' },
  { to: '/works', label: 'WORKS' },
  { to: '/contacts', label: 'CONTACTS' },
]

function normalizePath(pathname: string) {
  if (pathname === '/') return '/'
  return pathname.replace(/\/+$/, '') || '/'
}

export function Header({ overlay = false }: { overlay?: boolean }) {
  const { pathname } = useLocation()
  const currentPath = normalizePath(pathname)
  const warmRoute = (path: string) => () => prefetchRoute(path)

  return (
    <header className={`page-header js-header -visible${overlay ? ' -overlay' : ''}`}>
      <div className="menu js-menu">
        <div className="inner">
          <div className="item">
            <ul className="social-links js-social-links">
              {socials.map((social) => (
                <li className="item" key={social.href}>
                  <a className="link" href={social.href} title={social.label} target="_blank" rel="noopener noreferrer" aria-label={social.label}>
                    <i className={social.icon} aria-hidden="true" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <ul className="menu-list js-menu-list">
            {nav.map((item) => {
              const isCurrent = currentPath === item.to

              return (
                <li className="menu-item js-menu-item" key={item.to}>
                  {isCurrent ? (
                    <span className="link -active -disabled" aria-current="page" aria-disabled="true">
                      {item.label}
                    </span>
                  ) : (
                    <NavLink
                      className="link"
                      to={item.to}
                      end={item.to === '/'}
                      viewTransition
                      onPointerEnter={warmRoute(item.to)}
                      onFocus={warmRoute(item.to)}
                      onPointerDown={warmRoute(item.to)}
                    >
                      {item.label}
                    </NavLink>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </header>
  )
}
