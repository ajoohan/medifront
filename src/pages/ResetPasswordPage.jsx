import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUser } from '../context/UserContext'

// 비밀번호 재설정 메일의 링크로 들어오는 페이지 (/reset-password)
// Supabase가 URL의 복구 토큰으로 임시 세션을 만들어 주므로, 여기서 새 비밀번호를 저장한다.
function tr(err) {
  if (!err) return ''
  if (err === 'not-configured') return '인증 서버가 연결되지 않았습니다.'
  if (err.includes('session') || err.includes('Session'))
    return '링크가 만료되었거나 유효하지 않습니다. 로그인 창의 [아이디/비밀번호 찾기]에서 메일을 다시 요청해 주세요.'
  if (err.includes('at least 6')) return '비밀번호는 6자 이상이어야 합니다.'
  if (err.includes('different from the old')) return '이전과 다른 새 비밀번호를 입력해 주세요.'
  return err
}

export default function ResetPasswordPage() {
  const { updatePassword } = useUser()
  const navigate = useNavigate()
  const [pw, setPw] = useState('')
  const [confirm, setConfirm] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setMsg('')
    if (pw !== confirm) {
      setMsg('비밀번호가 일치하지 않습니다.')
      return
    }
    setBusy(true)
    const r = await updatePassword(pw)
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
            <p>새 비밀번호로 로그인된 상태입니다. 홈으로 이동해 이용을 계속하세요.</p>
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
            <p className="admin-login__sub">새로 사용할 비밀번호를 입력해 주세요.</p>

            {msg && <div className="admin-login__error">{msg}</div>}

            <form onSubmit={submit}>
              <div className="field">
                <label>새 비밀번호</label>
                <input
                  type="password"
                  placeholder="6자 이상"
                  minLength={6}
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
          </>
        )}
      </div>
    </div>
  )
}
