import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { NAV } from '../data'
import Logo from './Logo'
import { useUser } from '../context/UserContext'

// 관리자·운영자는 회원등급 대신 역할(최고관리자/일반관리자/운영자)을 표시한다.
// 권한은 회원등급이 아니라 JWT 의 역할 그룹으로 정해진다.
const roleLabel = (user) => user.adminRole || `${user.grade} 회원`

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
  const { user, openLogin, logout } = useUser()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const closeMenu = () => setMenuOpen(false)
  const handleLogin = () => {
    setMenuOpen(false)
    openLogin()
  }
  const handleLogout = () => {
    setMenuOpen(false)
    logout()
  }

  return (
    <header className={`header ${scrolled ? 'header--scrolled' : 'header--top'}`}>
      <div className="container header__inner">
        {/* 로고 클릭 시 기본 주소로 전체 새로고침 (SPA 이동 대신 페이지 리프레시) */}
        <a href="/" className="brand" aria-label="메디프론트 홈">
          <Logo variant="light" />
        </a>

        <nav className="nav">
          {NAV.map((item) => (
            <NavItem key={item.to || item.href} item={item} />
          ))}
        </nav>

        <div className="header__cta">
          {user ? (
            <>
              <span className="header__user">
                <b>{user.name}</b> 님 ({roleLabel(user)})
              </span>
              <button className="btn btn--login" onClick={handleLogout}>
                로그아웃
              </button>
            </>
          ) : (
            <button className="btn btn--login" onClick={handleLogin}>
              로그인
            </button>
          )}
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
        {user ? (
          <>
            <div className="mobile-user">
              <b>{user.name}</b> 님 ({roleLabel(user)})
            </div>
            <button className="mobile-login" onClick={handleLogout}>
              로그아웃
            </button>
          </>
        ) : (
          <button className="mobile-login" onClick={handleLogin}>
            로그인
          </button>
        )}
        <a href="/#contact" className="btn btn--primary" onClick={closeMenu}>
          무료 상담 신청
        </a>
      </div>
    </header>
  )
}
