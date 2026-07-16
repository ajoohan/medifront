import { useState } from 'react'
import Logo from '../../components/Logo'
import { useUser } from '../../context/UserContext'

// ⚠️ 절대 VITE_ADMIN_EMAIL / VITE_ADMIN_PASSWORD 를 되살리지 마세요.
// Vite 는 VITE_ 접두사 변수를 클라이언트 번들에 그대로 삽입하므로,
// 여기에 비밀번호를 두면 공개 JS 파일에 평문으로 노출됩니다.
// 인증은 서버(AWS Cognito)가 검증하고, 관리자 권한은 JWT 의 역할 그룹으로만
// 판정합니다 — 이 화면은 자격증명을 절대 들고 있지 않습니다.
const SAVED_ID_KEY = 'medifront_admin_saved_id' // 아이디 저장 체크 시 보관

const tr = (err) => {
  if (err.includes('NotAuthorizedException')) return '이메일 또는 비밀번호가 올바르지 않습니다.'
  if (err.includes('UserNotFoundException')) return '등록되지 않은 계정입니다.'
  if (err.includes('InvalidPasswordException'))
    return '비밀번호는 8자 이상이며 영문과 숫자를 모두 포함해야 합니다.'
  if (err.includes('LimitExceededException') || err.includes('TooManyRequests'))
    return '요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.'
  if (err.includes('not-configured')) return '서버 인증이 설정되지 않았습니다.'
  return err
}

export default function AdminLogin() {
  const { signInWithEmail, completeNewPassword } = useUser()
  // 아이디 저장이 되어 있으면 이메일 자동 입력(비밀번호만 입력하면 로그인)
  const savedId = localStorage.getItem(SAVED_ID_KEY) || ''
  const [email, setEmail] = useState(savedId)
  const [pw, setPw] = useState('')
  const [remember, setRemember] = useState(!!savedId)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  // 초대받은 관리자·운영자는 임시 비밀번호로 첫 로그인하며 새 비밀번호를 정해야 한다
  const [session, setSession] = useState('')
  const [newPw, setNewPw] = useState('')
  const [newPw2, setNewPw2] = useState('')

  // 로그인 성공 시 UserContext 가 세션을 반영하고, AdminPage 가 권한을 보고 화면을 바꾼다
  const rememberId = () => {
    if (remember) localStorage.setItem(SAVED_ID_KEY, email.trim())
    else localStorage.removeItem(SAVED_ID_KEY)
  }

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    const r = await signInWithEmail({ email: email.trim(), password: pw, autoLogin: remember })
    setBusy(false)
    if (r.challenge === 'NEW_PASSWORD_REQUIRED') {
      setSession(r.session)
      setPw('')
      return
    }
    if (r.error) {
      setError(tr(r.error))
      return
    }
    rememberId()
  }

  const submitNewPw = async (e) => {
    e.preventDefault()
    setError('')
    if (newPw !== newPw2) {
      setError('비밀번호가 일치하지 않습니다.')
      return
    }
    setBusy(true)
    const r = await completeNewPassword({
      email: email.trim(),
      password: newPw,
      session,
      autoLogin: remember,
    })
    setBusy(false)
    if (r.error) {
      // 챌린지 세션은 수 분 내 만료된다 — 만료되면 처음부터 다시
      if (r.error.includes('NotAuthorizedException')) {
        setSession('')
        setNewPw('')
        setNewPw2('')
        setError('시간이 초과되었습니다. 임시 비밀번호로 다시 로그인해 주세요.')
        return
      }
      setError(tr(r.error))
      return
    }
    rememberId()
  }

  // ── 임시 비밀번호 첫 로그인: 새 비밀번호 설정 ──
  if (session) {
    return (
      <div className="admin-login">
        <form className="admin-login__card" onSubmit={submitNewPw}>
          <div className="admin-login__brand">
            <Logo variant="dark" className="admin-login__logo" />
            <span>ADMIN</span>
          </div>
          <p className="admin-login__sub">새 비밀번호 설정</p>
          {error && <div className="admin-login__error">{error}</div>}
          <div className="field">
            <label>새 비밀번호</label>
            <input
              type="password"
              placeholder="8자 이상, 영문+숫자"
              minLength={8}
              autoComplete="new-password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="field">
            <label>새 비밀번호 확인</label>
            <input
              type="password"
              placeholder="비밀번호 재입력"
              autoComplete="new-password"
              value={newPw2}
              onChange={(e) => setNewPw2(e.target.value)}
              required
            />
          </div>
          <button
            type="submit"
            className="btn btn--primary btn--lg"
            style={{ width: '100%' }}
            disabled={busy}
          >
            {busy ? '설정 중...' : '비밀번호 설정하고 로그인'}
          </button>
        </form>
      </div>
    )
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

        <button
          type="submit"
          className="btn btn--primary btn--lg"
          style={{ width: '100%' }}
          disabled={busy}
        >
          {busy ? '로그인 중...' : '로그인'}
        </button>
      </form>
    </div>
  )
}
