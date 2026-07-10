import { Link } from 'react-router-dom'
import { BRAND, NAV } from '../data'
import Logo from './Logo'

export default function Footer() {
  const year = 2026
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer__top">
          <div className="footer__col footer__brand-col">
            <Link to="/" className="brand" aria-label="메디프론트 홈">
              <Logo variant="light" />
            </Link>
            <p className="footer__desc" style={{ marginTop: 18 }}>
              데이터와 AI로 증명하는 병원 성장. 마케팅 운영대행부터 경영 컨설팅, 개원 브랜딩, AI
              솔루션까지 — 원장님의 든든한 병·의원 컨설팅 파트너입니다.
            </p>
          </div>

          <div className="footer__col">
            <h5>바로가기</h5>
            {NAV.map((n) =>
              n.to ? (
                <Link key={n.to} to={n.to}>
                  {n.label}
                </Link>
              ) : (
                <a key={n.href} href={`/${n.href}`}>
                  {n.label}
                </a>
              ),
            )}
          </div>

          <div className="footer__col">
            <h5>상담·문의</h5>
            <a href={`tel:${BRAND.phone.replace(/-/g, '')}`}>전화 {BRAND.phone}</a>
            <a href={`mailto:${BRAND.email}`}>{BRAND.email}</a>
            <a href="/#contact">온라인 상담 신청</a>
          </div>
        </div>

        <div className="footer__policies">
          <Link to="/terms">이용약관</Link>
          <span>·</span>
          <Link to="/privacy" className="strong">
            개인정보처리방침
          </Link>
        </div>

        <div className="footer__legal">
          <div className="biz">
            {BRAND.bizName} · 대표 {BRAND.ceo}
            <br />
            사업자등록번호 {BRAND.bizNo} · 통신판매업 {BRAND.mailOrderNo}
            <br />
            {BRAND.address}
          </div>
          <div>
            © {year} {BRAND.nameEn}. All rights reserved.
          </div>
        </div>
      </div>
    </footer>
  )
}
