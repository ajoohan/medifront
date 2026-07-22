import { Link } from 'react-router-dom'

// 존재하지 않는 주소 — 빈 화면 대신 안내와 홈 동선을 준다 (App.jsx 의 path="*")
export default function NotFoundPage() {
  return (
    <section className="page-hero page-hero--gate">
      <div className="page-hero__grid-bg" />
      <div className="container">
        <span className="eyebrow">404 NOT FOUND</span>
        <h1>
          페이지를 <span className="accent">찾을 수 없습니다</span>
        </h1>
        <p>
          주소가 잘못 입력되었거나, 삭제·이동된 페이지입니다.
          <br />
          아래 버튼으로 홈으로 이동해 주세요.
        </p>
        <div className="gate__actions">
          <Link to="/" className="btn btn--light btn--lg">
            홈으로 가기
          </Link>
          <Link to="/magazine" className="btn btn--ghost btn--lg">
            매거진 보기
          </Link>
        </div>
      </div>
    </section>
  )
}
