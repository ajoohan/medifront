import { useState } from 'react'
import Logo from '../../components/Logo'

// ⚠️ 절대 VITE_ADMIN_EMAIL / VITE_ADMIN_PASSWORD 를 되살리지 마세요.
// Vite 는 VITE_ 접두사 변수를 클라이언트 번들에 그대로 삽입하므로,
// 여기에 비밀번호를 두면 공개 JS 파일에 평문으로 노출됩니다.
// 인증은 반드시 서버(AWS Cognito JWT 검증)에서 처리해야 합니다.
// 현재 이 컴포넌트는 사용되지 않습니다 — AdminPage.jsx 참고.
const SAVED_ID_KEY = 'medifront_admin_saved_id' // 아이디 저장 체크 시 보관

// Cognito 전환 시 인증 성공 콜백(onLogin)을 다시 props 로 받습니다.
export default function AdminLogin() {
  // 아이디 저장이 되어 있으면 이메일 자동 입력(비밀번호만 입력하면 로그인)
  const savedId = localStorage.getItem(SAVED_ID_KEY) || ''
  const [email, setEmail] = useState(savedId)
  const [pw, setPw] = useState('')
  const [remember, setRemember] = useState(!!savedId)
  const [error, setError] = useState('')

  const submit = (e) => {
    e.preventDefault()
    // TODO(Cognito): 서버에서 검증하도록 교체.
    //   const { idToken } = await cognitoSignIn(email.trim(), pw)
    // 검증 성공 시에만 아이디 저장 후 onLogin() 호출.
    setError('관리자 로그인은 서버 인증 전환 중 일시적으로 비활성화되었습니다.')
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
