import { useEffect, useState } from 'react'
import { NAV } from '../data'
import Logo from './Logo'

export default function Header() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const closeMenu = () => setMenuOpen(false)

  return (
    <header className={`header ${scrolled ? 'header--scrolled' : 'header--top'}`}>
      <div className="container header__inner">
        <a href="#top" className="brand" onClick={closeMenu} aria-label="메디프론트 홈">
          <Logo variant="light" />
        </a>

        <nav className="nav">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={item.highlight ? 'nav-highlight' : undefined}
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="header__cta">
          <a href="#contact" className="btn btn--primary">
            무료 상담 신청
          </a>
          <button
            className="nav-toggle"
            aria-label="메뉴 열기"
            onClick={() => setMenuOpen((v) => !v)}
          >
            {menuOpen ? '✕' : '☰'}
          </button>
        </div>
      </div>

      <div className={`mobile-menu ${menuOpen ? 'open' : ''}`}>
        {NAV.map((item) => (
          <a
            key={item.href}
            href={item.href}
            onClick={closeMenu}
            className={item.highlight ? 'nav-highlight' : undefined}
          >
            {item.label}
          </a>
        ))}
        <a href="#contact" className="btn btn--primary" onClick={closeMenu}>
          무료 상담 신청
        </a>
      </div>
    </header>
  )
}
