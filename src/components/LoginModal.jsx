import { useEffect, useState } from 'react'
import Logo from './Logo'
import { useUser } from '../context/UserContext'
import { formatPhone } from '../lib/phone'

// 회원유형 — 가입 2단계에서 선택 (매거진은 의사 회원 전용)
const MEMBER_TYPES = [
  { value: '의사', label: '의사 회원', desc: '대한민국 의사면허 보유자 · 모든 서비스 이용 가능' },
  { value: '병원', label: '병원 회원', desc: '병원/의원 소속 관계자 · 의사초빙, 임대, 개원입지' },
  {
    value: '일반',
    label: '일반 회원',
    desc: '의료계 관련 종사자 및 일반 · 의사초빙, 임대, 개원입지',
  },
]

// Supabase 에러 → 한국어 안내
function tr(err) {
  if (!err) return ''
  if (err === 'not-configured')
    return '인증 서버가 아직 연결되지 않았습니다. (Supabase 설정 후 사용 가능)'
  if (err === 'already-registered') return '이미 가입된 이메일입니다. 로그인해 주세요.'
  if (err.includes('Invalid login credentials')) return '이메일 또는 비밀번호가 올바르지 않습니다.'
  if (err.includes('Email not confirmed'))
    return '이메일 인증이 완료되지 않았습니다. 메일함의 인증 링크를 확인해 주세요.'
  if (err.includes('at least 6 characters')) return '비밀번호는 6자 이상이어야 합니다.'
  if (err.includes('rate limit') || err.includes('seconds'))
    return '요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.'
  return err
}

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="#4285F4"
      d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.39 3.62v3h3.86c2.26-2.08 3.58-5.15 3.58-8.81Z"
    />
    <path
      fill="#34A853"
      d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.86-3c-1.07.72-2.44 1.15-4.08 1.15-3.13 0-5.78-2.11-6.73-4.96H1.28v3.09A12 12 0 0 0 12 24Z"
    />
    <path
      fill="#FBBC05"
      d="M5.27 14.28A7.2 7.2 0 0 1 4.89 12c0-.79.14-1.56.38-2.28V6.63H1.28a12 12 0 0 0 0 10.74l3.99-3.09Z"
    />
    <path
      fill="#EA4335"
      d="M12 4.77c1.76 0 3.34.6 4.58 1.79l3.43-3.43A11.98 11.98 0 0 0 12 0 12 12 0 0 0 1.28 6.63l3.99 3.09C6.22 6.88 8.87 4.77 12 4.77Z"
    />
  </svg>
)

const AppleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M16.36 12.79c.03 3.26 2.86 4.34 2.89 4.36-.02.08-.45 1.55-1.49 3.07-.9 1.31-1.83 2.62-3.3 2.65-1.44.03-1.9-.85-3.55-.85-1.65 0-2.16.82-3.52.88-1.42.05-2.5-1.42-3.4-2.73C2.14 17.5.73 12.62 2.62 9.4a5.27 5.27 0 0 1 4.45-2.7c1.39-.03 2.7.93 3.55.93.85 0 2.44-1.15 4.12-.98.7.03 2.66.28 3.92 2.13-.1.06-2.34 1.37-2.3 4.01ZM13.63 4.87c.75-.91 1.26-2.17 1.12-3.43-1.08.04-2.39.72-3.17 1.63-.7.8-1.3 2.09-1.14 3.32 1.2.1 2.44-.61 3.19-1.52Z" />
  </svg>
)

export default function LoginModal({ open, onClose }) {
  const {
    authReady,
    demoLogin,
    signUpWithEmail,
    signInWithEmail,
    signInWithProvider,
    resendVerification,
    requestPasswordReset,
    getLoginPrefs,
    loginNotice,
  } = useUser()

  // mode: 'login' | 'signup' | 'verify'(인증 메일 안내) | 'recover'(아이디/비밀번호 찾기)
  // mode 추가: 'signup2' = 가입 2단계(이름·휴대폰·약관 동의)
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ email: '', password: '', confirm: '', name: '', phone: '' })
  const [agree, setAgree] = useState(false)
  const [grade, setGrade] = useState('일반') // 회원유형 (가입 2단계 선택 · 데모 로그인 공용)
  const [autoLogin, setAutoLogin] = useState(true) // 자동 로그인
  const [msg, setMsg] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) {
      // 저장된 아이디(이메일)와 자동 로그인 설정 프리필
      const prefs = getLoginPrefs()
      setMode('login')
      setForm({ email: prefs.savedEmail, password: '', confirm: '', name: '', phone: '' })
      setAutoLogin(prefs.autoLogin)
      setGrade('일반')
      setAgree(false)
      setMsg('')
      setInfo(loginNotice || '')
    }
  }, [open, getLoginPrefs, loginNotice])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))
  const switchMode = (m) => {
    setMode(m)
    setMsg('')
    setInfo('')
  }

  // 비밀번호 칸에서 엔터 → 로그인 버튼과 동일하게 제출 (IME 조합 중 엔터는 무시)
  const submitOnEnter = (e) => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      e.preventDefault()
      e.currentTarget.form?.requestSubmit()
    }
  }

  const submitLogin = async (e) => {
    e.preventDefault()
    setMsg('')
    if (!authReady) {
      // 데모 모드: 선택한 등급으로 로그인
      demoLogin({ name: form.email.trim() || '데모 회원', grade })
      onClose()
      return
    }
    setBusy(true)
    const r = await signInWithEmail({
      email: form.email.trim(),
      password: form.password,
      autoLogin,
    })
    setBusy(false)
    if (r.error) setMsg(tr(r.error))
    else onClose()
  }

  // 가입 1단계: 이메일/비밀번호 검증 후 2단계로 이동 (서버 호출 없음)
  const submitSignup = (e) => {
    e.preventDefault()
    setMsg('')
    if (form.password !== form.confirm) {
      setMsg('비밀번호가 일치하지 않습니다.')
      return
    }
    switchMode('signup2')
  }

  // 가입 2단계: 이름/휴대폰/약관 동의 수집 후 실제 가입 (인증 메일 발송)
  const submitSignup2 = async (e) => {
    e.preventDefault()
    setMsg('')
    if (!authReady) {
      setMsg(tr('not-configured'))
      return
    }
    setBusy(true)
    const r = await signUpWithEmail({
      email: form.email.trim(),
      password: form.password,
      name: form.name.trim(),
      phone: form.phone.trim(),
      grade,
    })
    setBusy(false)
    if (r.error) setMsg(tr(r.error))
    else switchMode('verify')
  }

  const social = async (provider) => {
    setMsg('')
    if (!authReady) {
      setMsg(tr('not-configured'))
      return
    }
    const r = await signInWithProvider(provider)
    if (r.error) setMsg(tr(r.error))
    // 성공 시 OAuth 페이지로 리다이렉트됨
  }

  const resend = async () => {
    setInfo('')
    const r = await resendVerification(form.email.trim())
    setInfo(r.ok ? '인증 메일을 다시 보냈습니다. 메일함을 확인해 주세요.' : tr(r.error))
  }

  const submitRecover = async (e) => {
    e.preventDefault()
    setMsg('')
    setInfo('')
    setBusy(true)
    const r = await requestPasswordReset(form.email.trim())
    setBusy(false)
    if (r.error) setMsg(tr(r.error))
    else setInfo('비밀번호 재설정 메일을 보냈습니다. 메일의 링크에서 새 비밀번호를 설정하세요.')
  }

  // 소셜 로그인: 각 제공자 설정 완료 후 true로 변경
  // - Google: Supabase > Authentication > Providers 에 Google Cloud OAuth ID/Secret 등록 후
  // - Apple: Apple Developer 계정($99/년) 등록 후
  const ENABLE_GOOGLE = false
  const ENABLE_APPLE = false
  const hasSocial = ENABLE_GOOGLE || ENABLE_APPLE

  const socialButtons = hasSocial && (
    <>
      <div className="login-modal__divider">
        <span>또는</span>
      </div>
      <div className="auth-social">
        {ENABLE_GOOGLE && (
          <button
            type="button"
            className="auth-social__btn auth-social__btn--google"
            onClick={() => social('google')}
          >
            <GoogleIcon />
            Google로 계속하기
          </button>
        )}
        {ENABLE_APPLE && (
          <button
            type="button"
            className="auth-social__btn auth-social__btn--apple"
            onClick={() => social('apple')}
          >
            <AppleIcon />
            Apple로 계속하기
          </button>
        )}
      </div>
    </>
  )

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="login-modal" onClick={(e) => e.stopPropagation()}>
        <button className="login-modal__close" onClick={onClose} aria-label="닫기">
          ✕
        </button>

        <div className="login-modal__logo">
          <Logo variant="dark" />
        </div>
        <p className="login-modal__sub">병원 성장의 파트너, 메디프론트</p>

        {msg && <div className="auth-error">{msg}</div>}
        {info && <div className="auth-info">{info}</div>}

        {/* ── 로그인 ── */}
        {mode === 'login' && (
          <>
            <form onSubmit={submitLogin}>
              <div className="field">
                <label>이메일</label>
                <input
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  value={form.email}
                  onChange={set('email')}
                  required
                />
              </div>
              <div className="field login-modal__pw">
                <label>비밀번호</label>
                <input
                  type="password"
                  placeholder="비밀번호"
                  autoComplete="current-password"
                  value={form.password}
                  onChange={set('password')}
                  onKeyDown={submitOnEnter}
                  required
                />
              </div>

              <label className="auth-remember">
                <input
                  type="checkbox"
                  checked={autoLogin}
                  onChange={(e) => setAutoLogin(e.target.checked)}
                />
                <span>자동 로그인</span>
                <small>체크 해제 시 브라우저 종료 후 로그아웃됩니다</small>
              </label>

              {!authReady && (
                <div className="field login-modal__pw">
                  <label>
                    회원유형 <span className="login-modal__demo">데모</span>
                  </label>
                  <div className="login-modal__grades">
                    {MEMBER_TYPES.map((t) => (
                      <button
                        key={t.value}
                        type="button"
                        className={grade === t.value ? 'is-active' : undefined}
                        onClick={() => setGrade(t.value)}
                      >
                        {t.value}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <button
                type="submit"
                className="btn btn--primary btn--lg"
                style={{ width: '100%' }}
                disabled={busy}
              >
                {busy ? '로그인 중...' : '로그인'}
              </button>
            </form>

            {socialButtons}

            <div className="login-modal__links">
              <button type="button" className="auth-strong" onClick={() => switchMode('signup')}>
                회원가입
              </button>
              <span>·</span>
              <button type="button" onClick={() => switchMode('recover')}>
                아이디/비밀번호 찾기
              </button>
            </div>
          </>
        )}

        {/* ── 아이디/비밀번호 찾기 ── */}
        {mode === 'recover' && (
          <>
            <div className="auth-notice" style={{ textAlign: 'left' }}>
              💡 <b>아이디 안내</b>: 아이디는 가입 시 사용한 <b>이메일 주소</b>입니다. 자주 쓰는
              이메일로 로그인해 보세요.
            </div>
            <form onSubmit={submitRecover}>
              <div className="field login-modal__pw">
                <label>가입 이메일</label>
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={set('email')}
                  required
                />
              </div>
              <button
                type="submit"
                className="btn btn--primary btn--lg"
                style={{ width: '100%' }}
                disabled={busy}
              >
                {busy ? '발송 중...' : '비밀번호 재설정 메일 발송'}
              </button>
            </form>
            <div className="login-modal__links">
              <button type="button" className="auth-strong" onClick={() => switchMode('login')}>
                로그인으로 돌아가기
              </button>
            </div>
          </>
        )}

        {/* ── 회원가입 ── */}
        {mode === 'signup' && (
          <>
            {!authReady && (
              <div className="auth-notice">인증 서버(Supabase) 연결 후 가입이 활성화됩니다.</div>
            )}
            <form onSubmit={submitSignup}>
              <div className="field">
                <label>이메일</label>
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={set('email')}
                  required
                />
              </div>
              <div className="field">
                <label>비밀번호</label>
                <input
                  type="password"
                  placeholder="6자 이상"
                  minLength={6}
                  autoComplete="new-password"
                  value={form.password}
                  onChange={set('password')}
                  required
                />
              </div>
              <div className="field login-modal__pw">
                <label>비밀번호 확인</label>
                <input
                  type="password"
                  placeholder="비밀번호 재입력"
                  autoComplete="new-password"
                  value={form.confirm}
                  onChange={set('confirm')}
                  required
                />
              </div>

              <button
                type="submit"
                className="btn btn--primary btn--lg"
                style={{ width: '100%' }}
                disabled={busy}
              >
                이메일로 가입하기
              </button>
            </form>

            {socialButtons}

            <div className="login-modal__links">
              <span>이미 계정이 있으신가요?</span>
              <button type="button" className="auth-strong" onClick={() => switchMode('login')}>
                로그인
              </button>
            </div>
          </>
        )}

        {/* ── 회원가입 2단계: 이름·휴대폰번호·약관 동의 ── */}
        {mode === 'signup2' && (
          <>
            <div
              className="auth-notice"
              style={{ background: 'var(--paper-blue)', color: 'var(--ink-700)' }}
            >
              마지막 단계입니다 (2/2) — 가입자 정보를 입력해 주세요.
            </div>
            <form onSubmit={submitSignup2}>
              <div className="field">
                <label>회원유형</label>
                <div className="member-types">
                  {MEMBER_TYPES.map((t) => (
                    <label
                      key={t.value}
                      className={`member-type${grade === t.value ? ' is-active' : ''}`}
                    >
                      <input
                        type="radio"
                        name="memberType"
                        value={t.value}
                        checked={grade === t.value}
                        onChange={() => setGrade(t.value)}
                      />
                      <b>{t.label}</b>
                      <small>{t.desc}</small>
                    </label>
                  ))}
                </div>
              </div>
              <div className="field">
                <label>이름</label>
                <input
                  type="text"
                  placeholder="홍길동"
                  value={form.name}
                  onChange={set('name')}
                  required
                />
              </div>
              <div className="field login-modal__pw">
                <label>휴대폰번호</label>
                <input
                  type="tel"
                  inputMode="numeric"
                  placeholder="010-0000-0000"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: formatPhone(e.target.value) }))}
                  required
                />
              </div>

              <label className="form__consent" style={{ margin: '0 0 16px' }}>
                <input
                  type="checkbox"
                  required
                  checked={agree}
                  onChange={(e) => setAgree(e.target.checked)}
                />
                <span>
                  <a href="/terms" target="_blank" rel="noreferrer" className="consent-link">
                    이용약관
                  </a>{' '}
                  및{' '}
                  <a href="/privacy" target="_blank" rel="noreferrer" className="consent-link">
                    개인정보처리방침
                  </a>
                  에 동의합니다.
                </span>
              </label>

              <button
                type="submit"
                className="btn btn--primary btn--lg"
                style={{ width: '100%' }}
                disabled={busy}
              >
                {busy ? '가입 중...' : '가입 완료'}
              </button>
            </form>
            <div className="login-modal__links">
              <button type="button" onClick={() => switchMode('signup')}>
                ← 이전 단계로
              </button>
            </div>
          </>
        )}

        {/* ── 인증 메일 안내 ── */}
        {mode === 'verify' && (
          <div className="auth-verify">
            <div className="auth-verify__icon">✉️</div>
            <h3>인증 메일을 보냈습니다</h3>
            <p>
              <b>{form.email}</b> 로 인증 메일을 발송했습니다.
              <br />
              메일함에서 <b>인증 링크를 클릭</b>하면 가입이 완료됩니다.
            </p>
            <p className="auth-verify__hint">메일이 보이지 않으면 스팸함을 확인해 주세요.</p>
            <div className="auth-verify__actions">
              <button type="button" className="btn btn--primary" onClick={resend}>
                인증 메일 재발송
              </button>
              <button type="button" className="auth-strong" onClick={() => switchMode('login')}>
                로그인으로
              </button>
            </div>
          </div>
        )}

        {!authReady && mode !== 'verify' && (
          <p className="login-modal__note">* 현재 데모 모드입니다. (인증 서버 연결 전)</p>
        )}
      </div>
    </div>
  )
}
