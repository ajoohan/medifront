import { useState } from 'react'
import { Link } from 'react-router-dom'

export default function LoginPage() {
  const [note, setNote] = useState(false)

  const onSubmit = (e) => {
    e.preventDefault()
    // TODO: 실제 로그인 인증 로직 연결 지점 (현재는 준비 중 안내만 표시)
    setNote(true)
  }

  return (
    <section className="section login-page">
      <div className="container">
        <div className="login-card">
          <h1 className="login-card__title">로그인</h1>
          <p className="login-card__sub">메디프론트 파트너 로그인</p>

          <form onSubmit={onSubmit}>
            <div className="field">
              <label>이메일</label>
              <input type="email" placeholder="you@example.com" required />
            </div>
            <div className="field">
              <label>비밀번호</label>
              <input type="password" placeholder="비밀번호" required />
            </div>

            {note && <p className="login-note">로그인 기능은 현재 준비 중입니다.</p>}

            <button type="submit" className="btn btn--primary btn--lg" style={{ width: '100%' }}>
              로그인
            </button>
          </form>

          <div className="login-card__foot">
            <a href="/#contact">상담 문의</a>
            <span className="login-card__divider" />
            <Link to="/">홈으로</Link>
          </div>
        </div>
      </div>
    </section>
  )
}
