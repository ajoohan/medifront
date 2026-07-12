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

export default function LoginModal({ open, onClose }) {
  const {
    signUpWithEmail,
    signInWithEmail,
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
  const [grade, setGrade] = useState('일반') // 회원유형 (가입 2단계 선택)
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
      </div>
    </div>
  )
}
