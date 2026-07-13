import { useState } from 'react'
import Logo from '../../components/Logo'

const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL
const ADMIN_PW = import.meta.env.VITE_ADMIN_PASSWORD
const SAVED_ID_KEY = 'medifront_admin_saved_id' // 아이디 저장 체크 시 보관

export default function AdminLogin({ onLogin }) {
  // 아이디 저장이 되어 있으면 이메일 자동 입력(비밀번호만 입력하면 로그인)
  const savedId = localStorage.getItem(SAVED_ID_KEY) || ''
  const [email, setEmail] = useState(savedId)
  const [pw, setPw] = useState('')
  const [remember, setRemember] = useState(!!savedId)
  const [error, setError] = useState('')

  const submit = (e) => {
    e.preventDefault()
    if (!ADMIN_EMAIL || !ADMIN_PW) {
      const missing = [!ADMIN_EMAIL && 'VITE_ADMIN_EMAIL', !ADMIN_PW && 'VITE_ADMIN_PASSWORD']
        .filter(Boolean)
        .join(', ')
      setError(`관리자 환경변수 누락: ${missing} — 환경변수 확인 후 재배포하세요.`)
      return
    }
    if (email.trim() === ADMIN_EMAIL && pw === ADMIN_PW) {
      setError('')
      // 아이디 저장 처리
      if (remember) localStorage.setItem(SAVED_ID_KEY, email.trim())
      else localStorage.removeItem(SAVED_ID_KEY)
      onLogin()
    } else {
      setError('이메일 또는 비밀번호가 올바르지 않습니다.')
    }
  }

  return (
    <div className="admin-login">
      <form className="admin-login__card" onSubmit={submit}>
        <div className="admin-login__brand">
          <Logo variant="dark" className="admin-login__logo" />
          <span>ADMIN</span>
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
        <div className="field">
          <label>비밀번호</label>
          <input
            type="password"
            placeholder="비밀번호"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            onKeyDown={(e) => {
              // 엔터 → 로그인 버튼과 동일하게 제출 (IME 조합 중 엔터는 무시)
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                e.preventDefault()
                e.currentTarget.form?.requestSubmit()
              }
            }}
            required
          />
        </div>

        <label className="admin-login__remember">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
          />
          <span>아이디 저장</span>
        </label>

        <button type="submit" className="btn btn--primary btn--lg" style={{ width: '100%' }}>
          로그인
        </button>
      </form>
    </div>
  )
}
