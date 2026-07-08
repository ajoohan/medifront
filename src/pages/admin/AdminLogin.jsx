import { useState } from 'react'

const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL
const ADMIN_PW = import.meta.env.VITE_ADMIN_PASSWORD

export default function AdminLogin({ onLogin }) {
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [error, setError] = useState('')

  const submit = (e) => {
    e.preventDefault()
    if (!ADMIN_EMAIL || !ADMIN_PW) {
      setError('관리자 계정이 설정되지 않았습니다. (.env 의 VITE_ADMIN_* 확인)')
      return
    }
    if (email.trim() === ADMIN_EMAIL && pw === ADMIN_PW) {
      setError('')
      onLogin()
    } else {
      setError('이메일 또는 비밀번호가 올바르지 않습니다.')
    }
  }

  return (
    <div className="admin-login">
      <form className="admin-login__card" onSubmit={submit}>
        <div className="admin-login__brand">
          MEDIFRONT <span>ADMIN</span>
        </div>
        <p className="admin-login__sub">관리자 로그인</p>

        {error && <div className="admin-login__error">{error}</div>}

        <div className="field">
          <label>이메일</label>
          <input
            type="email"
            placeholder="admin@medifront.co.kr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="field" style={{ marginBottom: 20 }}>
          <label>비밀번호</label>
          <input
            type="password"
            placeholder="비밀번호"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            required
          />
        </div>
        <button type="submit" className="btn btn--primary btn--lg" style={{ width: '100%' }}>
          로그인
        </button>
      </form>
    </div>
  )
}
