import { Link } from 'react-router-dom'
import Magazine from '../components/Magazine'
import useReveal from '../hooks/useReveal'
import { useUser } from '../context/UserContext'

// 의사·원장 등급만 열람 가능 — 일반/비로그인은 차단 화면
function MagazineGate({ loggedIn, grade, onLogin }) {
  return (
    <section className="page-hero page-hero--gate">
      <div className="page-hero__grid-bg" />
      <div className="container">
        <span className="eyebrow">MEMBERS ONLY</span>
        <h1>
          <span className="accent">의사 · 원장</span> 회원 전용
        </h1>
        <p>
          메디프론트 매거진은 의사 · 원장 등급 회원만 열람할 수 있습니다.
          {loggedIn ? ` 현재 '${grade}' 등급은 열람 권한이 없습니다.` : ' 로그인 후 이용해 주세요.'}
        </p>
        <div className="gate__actions">
          {loggedIn ? (
            <a href="/#contact" className="btn btn--light btn--lg">
              등급 문의하기
            </a>
          ) : (
            <button className="btn btn--light btn--lg" onClick={onLogin}>
              로그인
            </button>
          )}
          <Link to="/" className="btn btn--ghost btn--lg">
            홈으로
          </Link>
        </div>
      </div>
    </section>
  )
}

export default function MagazinePage() {
  useReveal()
  const { user, openLogin } = useUser()
  const allowed = user && (user.grade === '의사' || user.grade === '원장')

  if (!allowed) {
    return <MagazineGate loggedIn={!!user} grade={user?.grade} onLogin={openLogin} />
  }

  return (
    <>
      <section className="page-hero">
        <div className="page-hero__grid-bg" />
        <div className="container">
          <span className="eyebrow">MAGAZINE</span>
          <h1>
            병원 성장 <span className="accent">인사이트</span>
          </h1>
          <p>현장에서 검증된 병원 마케팅·경영·개원 노하우를 메디프론트가 정리해 드립니다.</p>
        </div>
      </section>
      <Magazine />
    </>
  )
}
