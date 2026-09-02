import { NavLink } from 'react-router-dom'
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

export function Header({ overlay = false }: { overlay?: boolean }) {
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
            {nav.map((item) => (
              <li className="menu-item js-menu-item" key={item.to}>
                <NavLink
                  className={({ isActive }) => `link${isActive ? ' -active' : ''}`}
                  to={item.to}
                  end={item.to === '/'}
                  onPointerEnter={warmRoute(item.to)}
                  onFocus={warmRoute(item.to)}
                  onPointerDown={warmRoute(item.to)}
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </header>
  )
}
