import { useEffect, useState } from 'react'
import Logo from './Logo'
import { useUser } from '../context/UserContext'
import { formatPhone } from '../lib/phone'
import { awsConfig } from '../lib/awsConfig'
import { isVerifyEnabled, verifyPhone } from '../lib/phoneVerify'

// 회원유형 — 가입 2단계에서 선택 (매거진은 의사 회원 전용)
const MEMBER_TYPES = [
  { value: '의사', label: '의사 회원', desc: '대한민국 의사면허 보유자' },
  { value: '병원', label: '병원 회원', desc: '병원/의원 소속 관계자' },
  { value: '일반', label: '일반 회원', desc: '의료계 관련 종사자 및 일반' },
]

// Cognito 에러 → 한국어 안내
function tr(err) {
  if (!err) return ''
  if (err === 'not-configured')
    return '인증 서버가 아직 연결되지 않았습니다. (AWS 백엔드 배포 후 사용 가능)'
  if (err === 'already-registered') return '이미 가입된 이메일입니다. 로그인해 주세요.'
  if (err.includes('NotAuthorizedException')) return '이메일 또는 비밀번호가 올바르지 않습니다.'
  if (err.includes('UserNotFoundException')) return '가입되지 않은 이메일입니다.'
  if (err.includes('UserNotConfirmedException'))
    return '이메일 인증이 완료되지 않았습니다. 메일로 받은 인증 코드를 입력해 주세요.'
  if (err.includes('CodeMismatchException')) return '인증 코드가 올바르지 않습니다.'
  if (err.includes('ExpiredCodeException'))
    return '인증 코드가 만료되었습니다. 코드를 다시 요청해 주세요.'
  if (err.includes('InvalidPasswordException') || err.includes('previousPassword'))
    return '비밀번호는 8자 이상이며 영문과 숫자를 모두 포함해야 합니다.'
  if (err.includes('LimitExceededException') || err.includes('TooManyRequests'))
    return '요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.'
  // 휴대폰 본인인증
  if (err === 'already-verified-member')
    return '이미 가입된 명의입니다. 기존 계정으로 로그인하거나 아이디 찾기를 이용해 주세요.'
  if (err.startsWith('verify-cancelled'))
    return '본인인증이 완료되지 않았습니다. 다시 시도해 주세요.'
  if (err === 'verify-failed') return '본인인증 확인에 실패했습니다. 다시 시도해 주세요.'
  if (err === 'verify-sdk-failed')
    return '본인인증 창을 열지 못했습니다. 잠시 후 다시 시도해 주세요.'
  if (err === 'verify-required') return '휴대폰 본인인증을 완료해 주세요.'
  if (err === 'verify-not-configured') return '본인인증 서비스가 아직 연결되지 않았습니다.'
  return err
}

// 메일 아이콘 (이메일 회원가입 버튼용)
function MailIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2" y="4" width="20" height="16" rx="3" />
      <path d="m3 6 9 7 9-7" />
    </svg>
  )
}

// 네이버 'N' 로고 (버튼용 인라인 SVG — 공식 브랜드 그린 배경에 흰 N)
function NaverIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true">
      <rect width="20" height="20" rx="4" fill="#03C75A" />
      <path fill="#fff" d="M11.35 10.25 8.5 6.1H6.2v7.8h2.45v-4.15l2.85 4.15h2.3V6.1h-2.45v4.15z" />
    </svg>
  )
}

// 구글 공식 'G' 로고 (버튼용 인라인 SVG)
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  )
}

export default function LoginModal({ open, onClose }) {
  const {
    user,
    profilePending,
    signUpWithEmail,
    confirmSignUp,
    signInWithEmail,
    signInWithGoogle,
    signInWithNaver,
    completeSocialProfile,
    completeNewPassword,
    resendVerification,
    requestPasswordReset,
    confirmPasswordReset,
    getLoginPrefs,
    loginNotice,
  } = useUser()

  // mode: 'login' | 'signup' | 'verify'(인증 코드 입력) | 'recover'(아이디/비밀번호 찾기)
  // mode 추가: 'signup2' = 가입 2단계(이름·휴대폰·약관 동의), 'recover2' = 재설정 코드 + 새 비밀번호
  //           'newpw' = 관리자 초대 계정의 임시 비밀번호 첫 로그인 (새 비밀번호 설정)
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({
    email: '',
    password: '',
    confirm: '',
    name: '',
    phone: '',
    code: '',
    licenseNo: '', // 의사 회원 신청 시 입력 — 관리자 승인 심사용
  })
  const [agree, setAgree] = useState(false)
  // 의사 회원 신청자의 면허 조회 동의 (보건복지부 기관조회는 정보주체 동의가 전제)
  const [licenseAgree, setLicenseAgree] = useState(false)
  const [grade, setGrade] = useState('일반') // 회원유형 (가입 2단계 선택)
  const [autoLogin, setAutoLogin] = useState(true) // 자동 로그인
  const [newPwSession, setNewPwSession] = useState('') // 임시 비밀번호 챌린지 세션
  // 휴대폰 본인인증 결과 — 티켓이 있으면 인증 완료 상태. 이름·휴대폰은 인증값으로 고정된다.
  const [verified, setVerified] = useState(null) // { ticket, name, phone }
  const [msg, setMsg] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) {
      // 소셜(구글/네이버) 첫 가입 — 가입 2/2 폼으로 바로 연다 (이름·휴대폰은 소셜 프로필로 프리필)
      if (profilePending && user) {
        setMode('social2')
        setForm({
          email: user.email || '',
          password: '',
          confirm: '',
          name: user.name || '',
          phone: user.phone && user.phone !== '-' ? formatPhone(user.phone) : '',
          code: '',
          licenseNo: '',
        })
        setGrade('일반')
        setAgree(false)
        setLicenseAgree(false)
        setVerified(null)
        setMsg('')
        setInfo('')
        return
      }
      // 저장된 아이디(이메일)와 자동 로그인 설정 프리필
      const prefs = getLoginPrefs()
      setMode('login')
      setForm({ email: prefs.savedEmail, password: '', confirm: '', name: '', phone: '', code: '' })
      setAutoLogin(prefs.autoLogin)
      setGrade('일반')
      setAgree(false)
      setLicenseAgree(false)
      setVerified(null)
      setMsg('')
      setInfo(loginNotice || '')
    }
  }, [open, getLoginPrefs, loginNotice, profilePending, user])

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

  // 비밀번호 확인 실시간 검사 — 확인란에 입력이 시작된 뒤부터 불일치를 알린다
  const pwMismatch = form.confirm.length > 0 && form.password !== form.confirm
  const switchMode = (m) => {
    setMode(m)
    setMsg('')
    setInfo('')
  }
  const switchModeKeepInfo = (m) => {
    setMode(m)
    setMsg('')
  }

  // GOOGLE 로그인/가입 — Hosted UI 로 이동 (성공 시 사이트로 복귀해 자동 로그인)
  const startGoogle = async () => {
    setMsg('')
    setBusy(true)
    const r = await signInWithGoogle()
    // 정상이면 페이지가 구글로 넘어간다 — 여기 도달했다면 설정 오류
    if (r?.error) {
      setBusy(false)
      setMsg(tr(r.error))
    }
  }

  // NAVER 로그인/가입 — 네이버 인증 화면으로 이동 (성공 시 사이트로 복귀해 자동 로그인)
  const startNaver = async () => {
    setMsg('')
    setBusy(true)
    const r = await signInWithNaver()
    if (r?.error) {
      setBusy(false)
      setMsg(tr(r.error))
    }
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
    // 관리자 초대 계정 — 임시 비밀번호이므로 새 비밀번호 설정 화면으로 넘긴다
    if (r.challenge === 'NEW_PASSWORD_REQUIRED') {
      setNewPwSession(r.session)
      setForm((f) => ({ ...f, password: '', confirm: '' }))
      setInfo('임시 비밀번호로 로그인했습니다. 사용할 새 비밀번호를 설정해 주세요.')
      switchModeKeepInfo('newpw')
      return
    }
    if (r.error) {
      // 인증 미완료 계정이면 코드 입력 화면으로 안내
      if (r.error.includes('UserNotConfirmedException')) {
        setInfo(tr(r.error))
        switchModeKeepInfo('verify')
        return
      }
      setMsg(tr(r.error))
    } else onClose()
  }

  // 임시 비밀번호 첫 로그인 마무리 — 새 비밀번호를 설정하면 그대로 로그인된다
  const submitNewPw = async (e) => {
    e.preventDefault()
    setMsg('')
    if (form.password !== form.confirm) {
      setMsg('비밀번호가 일치하지 않습니다.')
      return
    }
    setBusy(true)
    const r = await completeNewPassword({
      email: form.email.trim(),
      password: form.password,
      session: newPwSession,
      autoLogin,
    })
    setBusy(false)
    if (r.error) {
      // 세션은 수 분 내 만료된다 — 만료 시 임시 비밀번호로 다시 로그인해야 한다
      if (r.error.includes('NotAuthorizedException')) {
        setNewPwSession('')
        setInfo('시간이 초과되었습니다. 임시 비밀번호로 다시 로그인해 주세요.')
        switchModeKeepInfo('login')
        return
      }
      setMsg(tr(r.error))
      return
    }
    setNewPwSession('')
    onClose()
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

  // 가입 2단계: 이름/휴대폰/약관 동의 수집 후 실제 가입 (인증 코드 메일 발송)
  const submitSignup2 = async (e) => {
    e.preventDefault()
    setMsg('')
    if (isVerifyEnabled() && !verified) {
      setMsg('휴대폰 본인인증을 완료해 주세요.')
      return
    }
    setBusy(true)
    // grade 는 보내지 않는다 — 신규 가입은 항상 '일반'으로 시작하고,
    // '의사' 승격은 관리자가 면허번호를 확인한 뒤에만 수행한다.
    const r = await signUpWithEmail({
      email: form.email.trim(),
      password: form.password,
      name: form.name.trim(),
      phone: form.phone.trim(),
      licenseNo: grade === '의사' ? form.licenseNo.trim() : '',
      verifyTicket: verified?.ticket,
    })
    setBusy(false)
    if (r.error) setMsg(tr(r.error))
    else switchMode('verify')
  }

  // 휴대폰 본인인증 실행 — 성공하면 이름·휴대폰이 인증된 값으로 채워지고 잠긴다
  const startVerify = async () => {
    setMsg('')
    setBusy(true)
    const r = await verifyPhone()
    setBusy(false)
    if (r.error) {
      setMsg(tr(r.error))
      return
    }
    setVerified({ ticket: r.ticket, name: r.name, phone: r.phone })
    setForm((f) => ({ ...f, name: r.name, phone: formatPhone(r.phone) }))
  }

  // 소셜(구글/네이버) 가입 2/2 폼 제출 — 회원유형·면허·이름·휴대폰을 회원 정보에 저장
  const submitSocial2 = async (e) => {
    e.preventDefault()
    setMsg('')
    if (isVerifyEnabled() && !verified) {
      setMsg('휴대폰 본인인증을 완료해 주세요.')
      return
    }
    setBusy(true)
    const r = await completeSocialProfile({
      memberType: grade,
      licenseNo: grade === '의사' ? form.licenseNo.trim() : '',
      name: form.name.trim(),
      phone: form.phone.trim(),
      verifyTicket: verified?.ticket,
    })
    setBusy(false)
    if (r.error) setMsg(tr(r.error))
    else onClose()
  }

  const resend = async () => {
    setInfo('')
    const r = await resendVerification(form.email.trim())
    setInfo(r.ok ? '인증 코드를 다시 보냈습니다. 메일함을 확인해 주세요.' : tr(r.error))
  }

  // 가입 인증 코드 확인 → 성공 시 입력해 둔 비밀번호로 자동 로그인
  const submitVerify = async (e) => {
    e.preventDefault()
    setMsg('')
    setBusy(true)
    const r = await confirmSignUp({ email: form.email.trim(), code: form.code.trim() })
    if (r.error) {
      setBusy(false)
      setMsg(tr(r.error))
      return
    }
    if (form.password) {
      const login = await signInWithEmail({
        email: form.email.trim(),
        password: form.password,
        autoLogin,
      })
      setBusy(false)
      if (!login.error) {
        onClose()
        return
      }
    } else {
      setBusy(false)
    }
    setInfo('이메일 인증이 완료되었습니다. 로그인해 주세요.')
    switchModeKeepInfo('login')
  }

  const submitRecover = async (e) => {
    e.preventDefault()
    setMsg('')
    setInfo('')
    setBusy(true)
    const r = await requestPasswordReset(form.email.trim())
    setBusy(false)
    if (r.error) setMsg(tr(r.error))
    else {
      setInfo('재설정 코드를 메일로 보냈습니다. 코드와 새 비밀번호를 입력해 주세요.')
      switchModeKeepInfo('recover2')
    }
  }

  // 재설정 코드 + 새 비밀번호 확정
  const submitRecover2 = async (e) => {
    e.preventDefault()
    setMsg('')
    if (form.password !== form.confirm) {
      setMsg('비밀번호가 일치하지 않습니다.')
      return
    }
    setBusy(true)
    const r = await confirmPasswordReset({
      email: form.email.trim(),
      code: form.code.trim(),
      password: form.password,
    })
    setBusy(false)
    if (r.error) setMsg(tr(r.error))
    else {
      setInfo('비밀번호가 변경되었습니다. 새 비밀번호로 로그인해 주세요.')
      setForm((f) => ({ ...f, password: '', confirm: '', code: '' }))
      switchModeKeepInfo('login')
    }
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

            <div className="auth-divider">
              <span>또는</span>
            </div>
            <button
              type="button"
              className="btn-social btn-social--email"
              onClick={() => switchMode('signup')}
            >
              <MailIcon />
              메일로 회원가입
            </button>
            <button type="button" className="btn-social" onClick={startGoogle} disabled={busy}>
              <GoogleIcon />
              GOOGLE 로그인
            </button>
            {awsConfig.naverClientId && (
              <button
                type="button"
                className="btn-social btn-social--naver"
                onClick={startNaver}
                disabled={busy}
              >
                <NaverIcon />
                NAVER 로그인
              </button>
            )}

            <div className="login-modal__links">
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
                {busy ? '발송 중...' : '비밀번호 재설정 코드 발송'}
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
                  placeholder="8자 이상, 영문+숫자"
                  minLength={8}
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
                  aria-invalid={pwMismatch}
                  required
                />
                {pwMismatch && <p className="field-error">비밀번호가 일치하지 않습니다.</p>}
              </div>

              <button
                type="submit"
                className="btn btn--primary btn--lg"
                style={{ width: '100%' }}
                disabled={busy || pwMismatch}
              >
                이메일로 가입하기
              </button>
            </form>

            <div className="auth-divider">
              <span>또는</span>
            </div>
            <button type="button" className="btn-social" onClick={startGoogle} disabled={busy}>
              <GoogleIcon />
              GOOGLE 로그인
            </button>
            {awsConfig.naverClientId && (
              <button
                type="button"
                className="btn-social btn-social--naver"
                onClick={startNaver}
                disabled={busy}
              >
                <NaverIcon />
                NAVER 로그인
              </button>
            )}

            <div className="login-modal__links">
              <span>이미 계정이 있으신가요?</span>
              <button type="button" className="auth-strong" onClick={() => switchMode('login')}>
                로그인
              </button>
            </div>
          </>
        )}

        {/* ── 회원가입 2단계: 유형·이름·휴대폰번호·약관 동의 ──
            signup2 = 이메일 가입 2단계 / social2 = 구글·네이버 가입 직후(같은 폼, 제출만 다름) */}
        {(mode === 'signup2' || mode === 'social2') && (
          <>
            <div className="auth-step">
              <span className="auth-step__badge">2/2</span>
              <div className="auth-step__text">
                <b>{mode === 'social2' ? '가입을 환영합니다!' : '거의 다 됐습니다'}</b>
                <span>회원유형과 가입자 정보를 입력해 주세요</span>
              </div>
            </div>
            <form onSubmit={mode === 'social2' ? submitSocial2 : submitSignup2}>
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
              {/* 의사 회원은 면허 확인 후 관리자가 승인 — 가입 즉시 부여되지 않는다 */}
              {grade === '의사' && (
                <div className="field">
                  <label>의사면허번호</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="면허번호를 입력해 주세요"
                    value={form.licenseNo}
                    onChange={set('licenseNo')}
                    required
                  />
                  <small className="login-modal__hint">
                    입력하신 면허번호 확인 후 의사 회원으로 승인되며, 승인 전까지는 일반 회원으로
                    이용하실 수 있습니다. 매거진은 승인 후 열람 가능합니다.
                  </small>
                  {/* 보건복지부 기관조회로 등록 여부를 확인하려면 정보주체 동의가 필요하다 */}
                  <label className="form__consent" style={{ margin: '10px 0 0' }}>
                    <input
                      type="checkbox"
                      required
                      checked={licenseAgree}
                      onChange={(e) => setLicenseAgree(e.target.checked)}
                    />
                    <span>
                      의사 회원 승인을 위해 <b>보건복지부 면허(자격) 등록 여부 조회</b>에
                      동의합니다. (성명·면허번호에 한함)
                    </span>
                  </label>
                </div>
              )}
              {/* 휴대폰 본인인증 — 인증사 계약 전에는 표시되지 않는다(isVerifyEnabled) */}
              {isVerifyEnabled() && (
                <div className="field">
                  <label>휴대폰 본인인증</label>
                  {verified ? (
                    <div className="verify-done">
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                      <span>
                        본인인증 완료 — <b>{verified.name}</b>
                      </span>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="btn-verify"
                        onClick={startVerify}
                        disabled={busy}
                      >
                        {busy ? '인증 중...' : '휴대폰으로 본인인증'}
                      </button>
                      <small className="login-modal__hint">
                        인증하시면 이름과 휴대폰번호가 자동으로 입력됩니다.
                      </small>
                    </>
                  )}
                </div>
              )}
              <div className="field">
                <label>이름</label>
                <input
                  type="text"
                  placeholder="홍길동"
                  value={form.name}
                  onChange={set('name')}
                  readOnly={!!verified}
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
                  readOnly={!!verified}
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
                {busy ? '저장 중...' : '가입 완료'}
              </button>
            </form>
            {mode === 'signup2' && (
              <div className="login-modal__links">
                <button type="button" onClick={() => switchMode('signup')}>
                  ← 이전 단계로
                </button>
              </div>
            )}
          </>
        )}

        {/* ── 인증 코드 입력 (가입 확인) ── */}
        {mode === 'verify' && (
          <div className="auth-verify">
            <div className="auth-verify__badge" aria-hidden="true">
              <svg
                width="26"
                height="26"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="2" y="4" width="20" height="16" rx="3" />
                <path d="m3 6 9 7 9-7" />
              </svg>
            </div>
            <h3>인증 코드를 입력해 주세요</h3>
            <p>
              <b>{form.email}</b> 로<br />
              6자리 코드를 보냈습니다.
            </p>
            <form onSubmit={submitVerify}>
              <input
                className="auth-code"
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                autoComplete="one-time-code"
                value={form.code}
                onChange={(e) =>
                  setForm((f) => ({ ...f, code: e.target.value.replace(/\D/g, '') }))
                }
                required
                autoFocus
              />
              <button
                type="submit"
                className="btn btn--primary btn--lg"
                style={{ width: '100%' }}
                disabled={busy || form.code.trim().length < 6}
              >
                {busy ? '확인 중...' : '인증 완료'}
              </button>
            </form>
            <p className="auth-verify__hint">메일이 보이지 않으면 스팸함을 확인해 주세요.</p>
            <div className="login-modal__links">
              <button type="button" onClick={resend}>
                코드 재발송
              </button>
              <span>·</span>
              <button type="button" className="auth-strong" onClick={() => switchMode('login')}>
                로그인으로
              </button>
            </div>
          </div>
        )}

        {/* ── 재설정 코드 + 새 비밀번호 ── */}
        {mode === 'newpw' && (
          <>
            <form onSubmit={submitNewPw}>
              <div className="field">
                <label>새 비밀번호</label>
                <input
                  type="password"
                  placeholder="8자 이상, 영문+숫자"
                  minLength={8}
                  autoComplete="new-password"
                  value={form.password}
                  onChange={set('password')}
                  required
                  autoFocus
                />
              </div>
              <div className="field login-modal__pw">
                <label>새 비밀번호 확인</label>
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
                {busy ? '설정 중...' : '비밀번호 설정하고 로그인'}
              </button>
            </form>
            <div className="login-modal__links">
              <button type="button" onClick={() => switchMode('login')}>
                ← 로그인으로
              </button>
            </div>
          </>
        )}

        {mode === 'recover2' && (
          <>
            <form onSubmit={submitRecover2}>
              <div className="field">
                <label>인증 코드</label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="메일로 받은 6자리"
                  autoComplete="one-time-code"
                  value={form.code}
                  onChange={set('code')}
                  required
                />
              </div>
              <div className="field">
                <label>새 비밀번호</label>
                <input
                  type="password"
                  placeholder="8자 이상, 영문+숫자"
                  minLength={8}
                  autoComplete="new-password"
                  value={form.password}
                  onChange={set('password')}
                  required
                />
              </div>
              <div className="field login-modal__pw">
                <label>새 비밀번호 확인</label>
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
                {busy ? '변경 중...' : '비밀번호 변경'}
              </button>
            </form>
            <div className="login-modal__links">
              <button type="button" onClick={() => switchMode('recover')}>
                ← 코드 다시 받기
              </button>
              <span>·</span>
              <button type="button" className="auth-strong" onClick={() => switchMode('login')}>
                로그인으로
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
