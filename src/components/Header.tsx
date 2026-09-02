import { NavLink } from 'react-router-dom'
import { prefetchRoute } from '../app/prefetch'

const socialLinks = [
  { href: 'https://t.me/pavelkayler', title: 'Telegram', icon: 'fab fa-telegram-plane' },
  { href: 'https://www.instagram.com/pavelkayler/', title: 'Instagram', icon: 'fab fa-instagram' },
  { href: 'https://vk.com/pavelkayler', title: 'VK', icon: 'fab fa-vk' },
  { href: 'https://www.youtube.com/@pavelkayler', title: 'YouTube', icon: 'fab fa-youtube' },
]

interface HeaderProps {
  overlay: boolean
}

function SpaLink({ to, children }: { to: string; children: string }) {
  const prefetch = () => prefetchRoute(to)
  return (
    <NavLink
      className="link"
      to={to}
      onMouseEnter={prefetch}
      onFocus={prefetch}
      onPointerDown={prefetch}
    >
      {children}
    </NavLink>
  )
}

export function Header({ overlay }: HeaderProps) {
  return (
    <header className={`page-header js-header${overlay ? ' -overlay' : ''}`}>
      <div className="menu js-menu">
        <div className="inner">
          <div className="item">
            <ul className="social-links js-social-links">
              {socialLinks.map((social) => (
                <li className="item" key={social.href}>
                  <a className="link" href={social.href} title={social.title} target="_blank" rel="noopener noreferrer">
                    <i className={social.icon} />
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <ul className="menu-list js-menu-list">
            <li className="menu-item js-menu-item"><SpaLink to="/">HOME</SpaLink></li>
            <li className="menu-item js-menu-item"><SpaLink to="/works">WORKS</SpaLink></li>
            <li className="menu-item js-menu-item"><SpaLink to="/contacts">CONTACTS</SpaLink></li>
          </ul>
        </div>
      </div>
    </header>
  )
}
