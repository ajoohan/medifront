import { Link } from 'react-router-dom'
import { useUser } from '../context/UserContext'

// 매거진 접근 차단 화면 — 의사 회원 전용 (목록/상세 공용)
export default function MagazineGate() {
  const { user, openLogin } = useUser()
  const loggedIn = !!user

  return (
    <section className="page-hero page-hero--gate">
      <div className="page-hero__grid-bg" />
      <div className="container">
        <span className="eyebrow">MEMBERS ONLY</span>
        <h1>
          <span className="accent">의사 회원</span> 전용
        </h1>
        <p>
          메디프론트 매거진은 의사회원만 열람할 수 있습니다.
          {loggedIn
            ? ` 현재 '${user.grade} 회원'은 열람 권한이 없습니다.`
            : ' 로그인 후 이용해 주세요.'}
        </p>
        <div className="gate__actions">
          {loggedIn ? (
            <a href="/#contact" className="btn btn--light btn--lg">
              등급 문의하기
            </a>
          ) : (
            <button className="btn btn--light btn--lg" onClick={openLogin}>
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
