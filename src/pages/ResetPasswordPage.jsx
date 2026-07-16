import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useUser } from '../context/UserContext'

// 비밀번호 재설정 페이지 (/reset-password)
// 메일로 받은 6자리 재설정 코드와 새 비밀번호를 입력해 변경한다.
// (관리자가 재설정 코드를 발송한 경우에도 이 페이지에서 처리)
function tr(err) {
  if (!err) return ''
  if (err === 'not-configured') return '인증 서버가 연결되지 않았습니다.'
  if (err.includes('CodeMismatchException')) return '인증 코드가 올바르지 않습니다.'
  if (err.includes('ExpiredCodeException'))
    return '인증 코드가 만료되었습니다. 코드를 다시 요청해 주세요.'
  if (err.includes('UserNotFoundException')) return '가입되지 않은 이메일입니다.'
  if (err.includes('InvalidPasswordException'))
    return '비밀번호는 8자 이상이며 영문과 숫자를 모두 포함해야 합니다.'
  if (err.includes('LimitExceededException'))
    return '요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.'
  return err
}

export default function ResetPasswordPage() {
  const { requestPasswordReset, confirmPasswordReset } = useUser()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [email, setEmail] = useState(params.get('email') || '')
  const [code, setCode] = useState('')
  const [pw, setPw] = useState('')
  const [confirm, setConfirm] = useState('')
  const [msg, setMsg] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  const resend = async () => {
    setMsg('')
    setInfo('')
    if (!email.trim()) {
      setMsg('가입 이메일을 먼저 입력해 주세요.')
      return
    }
    const r = await requestPasswordReset(email.trim())
    if (r.error) setMsg(tr(r.error))
    else setInfo('재설정 코드를 메일로 보냈습니다. 메일함을 확인해 주세요.')
  }

  const submit = async (e) => {
    e.preventDefault()
    setMsg('')
    setInfo('')
    if (pw !== confirm) {
      setMsg('비밀번호가 일치하지 않습니다.')
      return
    }
    setBusy(true)
    const r = await confirmPasswordReset({ email: email.trim(), code: code.trim(), password: pw })
    setBusy(false)
    if (r.error) setMsg(tr(r.error))
    else setDone(true)
  }

  return (
    <div className="admin-login">
      <div className="admin-login__card">
        {done ? (
          <div className="auth-verify">
            <div className="auth-verify__icon">✅</div>
            <h3>비밀번호가 변경되었습니다</h3>
            <p>새 비밀번호로 로그인해 이용을 계속하세요.</p>
            <div className="auth-verify__actions">
              <button className="btn btn--primary" onClick={() => navigate('/')}>
                홈으로 이동
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="admin-login__brand">
              MEDIFRONT <span style={{ color: 'var(--primary)' }}>비밀번호 재설정</span>
            </div>
            <p className="admin-login__sub">
              메일로 받은 재설정 코드와 새 비밀번호를 입력해 주세요.
            </p>

            {msg && <div className="admin-login__error">{msg}</div>}
            {info && <div className="auth-info">{info}</div>}

            <form onSubmit={submit}>
              <div className="field">
                <label>가입 이메일</label>
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label>재설정 코드</label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="메일로 받은 6자리"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label>새 비밀번호</label>
                <input
                  type="password"
                  placeholder="8자 이상, 영문+숫자"
                  minLength={8}
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  required
                />
              </div>
              <div className="field" style={{ marginBottom: 20 }}>
                <label>새 비밀번호 확인</label>
                <input
                  type="password"
                  placeholder="비밀번호 재입력"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                />
              </div>
              <button
                type="submit"
                className="btn btn--primary btn--lg"
                style={{ width: '100%' }}
                disabled={busy}
              >
                {busy ? '변경 중...' : '비밀번호 변경'}
              </button>
            </form>
            <div className="login-modal__links" style={{ marginTop: 14 }}>
              <button type="button" onClick={resend}>
                재설정 코드 다시 받기
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
