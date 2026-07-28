import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { NAV } from '../data'
import useConsultingDocs from '../hooks/useConsultingDocs'
import Logo from './Logo'
import { useUser } from '../context/UserContext'

// 관리자·운영자는 회원등급 대신 역할(최고관리자/일반관리자/운영자)을 표시한다.
// 권한은 회원등급이 아니라 JWT 의 역할 그룹으로 정해진다.
const roleLabel = (user) => user.adminRole || `${user.grade} 회원`

// 메뉴에 개수 배지를 붙인다 — 노출 중인 컨설팅 자료 수가 그대로 반영된다
const navItemsWith = (docCount) =>
  NAV.map((item) => (item.to === '/consulting' ? { ...item, badge: docCount } : item))

// 소셜 로그인으로 접속한 회원에게 어떤 계정으로 들어왔는지 알려준다.
// 헤더 폭을 잡아먹지 않도록 머리글자 한 자(G/N)만 원형 배지로 표시하고,
// 전체 이름은 title 로 알린다. (이메일 가입자는 표시하지 않음)
const PROVIDERS = {
  google: { initial: 'G', name: 'Google', className: 'user-badge user-badge--google' },
  naver: { initial: 'N', name: 'NAVER', className: 'user-badge user-badge--naver' },
}
function ProviderBadge({ user }) {
  const p = PROVIDERS[user.provider]
  if (!p) return null
  return (
    <span className={p.className} title={`${p.name} 계정으로 로그인`}>
      <span aria-hidden="true">{p.initial}</span>
      <span className="sr-only">{p.name} 계정</span>
    </span>
  )
}

// 네비 항목 렌더: to(라우트)면 Link, href(홈 앵커)면 '/#앵커' 링크로
function NavItem({ item, onClick }) {
  const className = item.highlight ? 'nav-highlight' : undefined
  // badge: 항목 옆 개수 표시 (예: 컨설팅 자료 수)
  const label = (
    <>
      {item.label}
      {item.badge ? <span className="nav-badge">{item.badge}</span> : null}
    </>
  )
  if (item.to) {
    return (
      <Link to={item.to} className={className} onClick={onClick}>
        {label}
      </Link>
    )
  }
  return (
    <a href={`/${item.href}`} className={className} onClick={onClick}>
      {label}
    </a>
  )
}

export default function Header() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const { user, openLogin, logout } = useUser()
  // 배지는 '지금 열람할 수 있는' 자료 수 — 준비 중(딤 처리)인 자료는 세지 않는다
  const navItems = navItemsWith(useConsultingDocs().filter((d) => !d.hidden).length)

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
          {navItems.map((item) => (
            <NavItem key={item.to || item.href} item={item} />
          ))}
        </nav>

        <div className="header__cta">
          {user ? (
            <>
              <span className="header__user">
                <b>{user.name}</b> 님<span className="header__role"> ({roleLabel(user)})</span>
                <ProviderBadge user={user} />
              </span>
              <button className="btn btn--login" onClick={handleLogout}>
                로그아웃
              </button>
            </>
          ) : (
            <button className="btn btn--login" onClick={handleLogin}>
              로그인 / 회원가입
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
        {navItems.map((item) => (
          <NavItem key={item.to || item.href} item={item} onClick={closeMenu} />
        ))}
        {user ? (
          <>
            <div className="mobile-user">
              <b>{user.name}</b> 님 ({roleLabel(user)})
              <ProviderBadge user={user} />
            </div>
            <button className="mobile-login" onClick={handleLogout}>
              로그아웃
            </button>
          </>
        ) : (
          <button className="mobile-login" onClick={handleLogin}>
            로그인 / 회원가입
          </button>
        )}
        <a href="/#contact" className="btn btn--primary" onClick={closeMenu}>
          무료 상담 신청
        </a>
      </div>
    </header>
  )
}
