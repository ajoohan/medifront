import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { NAV } from '../data'
import Logo from './Logo'

// 네비 항목 렌더: to(라우트)면 Link, href(홈 앵커)면 '/#앵커' 링크로
function NavItem({ item, onClick }) {
  const className = item.highlight ? 'nav-highlight' : undefined
  if (item.to) {
    return (
      <Link to={item.to} className={className} onClick={onClick}>
        {item.label}
      </Link>
    )
  }
  return (
    <a href={`/${item.href}`} className={className} onClick={onClick}>
      {item.label}
    </a>
  )
}

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
        <Link to="/" className="brand" onClick={closeMenu} aria-label="메디프론트 홈">
          <Logo variant="light" />
        </Link>

        <nav className="nav">
          {NAV.map((item) => (
            <NavItem key={item.to || item.href} item={item} />
          ))}
        </nav>

        <div className="header__cta">
          <Link to="/login" className="btn btn--login" onClick={closeMenu}>
            로그인
          </Link>
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
          <NavItem key={item.to || item.href} item={item} onClick={closeMenu} />
        ))}
        <Link to="/login" onClick={closeMenu}>
          로그인
        </Link>
        <a href="/#contact" className="btn btn--primary" onClick={closeMenu}>
          무료 상담 신청
        </a>
      </div>
    </header>
  )
}
