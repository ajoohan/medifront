/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import * as auth from '../lib/authClient'
import { apiGet, apiSend } from '../lib/api'

// 공개 사이트 로그인 세션 (AWS Cognito 이메일 인증)
const UserContext = createContext(null)
const AUTOLOGIN_KEY = 'medifront_autologin' // '0'이면 브라우저 종료 시 로그아웃
const TAB_KEY = 'medifront_tab' // sessionStorage — 브라우저(탭 세션) 생존 마커
const SAVED_EMAIL_KEY = 'medifront_saved_email' // 아이디(이메일) 기억

// Cognito user → 사이트 공용 user 형태 { name, email, grade, isAdmin, adminRole }
function mapAuthUser(u) {
  if (!u) return null
  return {
    name: u.name || u.email?.split('@')[0] || '회원',
    email: u.email,
    grade: u.grade || '일반',
    // 역할은 서명된 JWT 의 그룹에서만 온다 — 아래 withDbGrade 가 DB 의 회원등급을
    // 덮어써도 이 두 값은 유지되어야 한다.
    isAdmin: !!u.isAdmin,
    adminRole: u.adminRole || null, // 최고관리자 | 일반관리자 | 운영자
  }
}

// members 테이블 조회는 applyUser(UserProvider 내부)에서 수행한다 —
// 관리자 화면에서 변경한 등급 반영 + 소셜 가입 2/2 미완성(profile_done) 감지를 겸한다.

export function UserProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loginOpen, setLoginOpen] = useState(false)
  const [loginNotice, setLoginNotice] = useState('') // 로그인 창 상단 안내 문구
  // 소셜(구글/네이버) 가입자가 아직 가입 2/2(유형·이름·휴대폰)를 제출하지 않은 상태.
  // true 면 로그인 창이 2/2 폼(social2)으로 열린다.
  const [profilePending, setProfilePending] = useState(false)
  // 저장된 세션 복원이 끝났는지. 이 값이 false 인 동안 user 가 null 인 것은
  // '비로그인'이 아니라 '아직 모름'이다 — 권한 화면이 이를 구분해야 깜빡임이 없다.
  const [authReady, setAuthReady] = useState(false)

  // 저장된 세션 복원 (자동 로그인 꺼진 상태에서 브라우저를 새로 연 경우에는 세션 종료)
  useEffect(() => {
    let unsub
    const init = async () => {
      // 소셜 로그인 복귀(?code=)면 먼저 토큰 교환을 끝낸다 — 아래 세션 복원이 이어받는다
      await auth.completeOAuthRedirect()
      const keepLogin = localStorage.getItem(AUTOLOGIN_KEY) !== '0'
      const newBrowserSession = !sessionStorage.getItem(TAB_KEY)
      sessionStorage.setItem(TAB_KEY, '1')
      if (!keepLogin && newBrowserSession) {
        await auth.signOut()
      }
      // 등급 DB 조회가 끝나기 전에도 기본 정보로 먼저 표시하고, 조회 후 등급만 보정.
      // 이때 소셜 가입자의 2/2 미완성(profile_done:false)도 함께 감지한다.
      const applyUser = (base) => {
        setUser(base)
        if (!base) {
          setProfilePending(false)
          return
        }
        apiGet('/members', { email: base.email }).then((rows) => {
          const row = rows?.[0]
          if (row?.grade) {
            setUser((cur) => (cur && cur.email === base.email ? { ...cur, grade: row.grade } : cur))
          }
          // 소셜 첫 가입 → 가입 2/2 폼을 자동으로 띄운다 (제출 전까지 재로그인마다 반복)
          if (row && row.profile_done === false && !base.isAdmin) {
            setProfilePending(true)
            setLoginNotice('')
            setLoginOpen(true)
          }
        })
      }
      const session = await auth.getSession()
      applyUser(mapAuthUser(session))
      setAuthReady(true)
      unsub = auth.onAuthChange((u) => applyUser(mapAuthUser(u)))
    }
    // 세션 복원이 실패해도 화면이 로딩에 갇히면 안 된다
    init().finally(() => setAuthReady(true))
    return () => unsub?.()
  }, [])

  // ── 이메일 회원가입 (인증 코드 메일 발송) — 이름/휴대폰번호/회원유형은 2단계에서 수집 ──
  const signUpWithEmail = useCallback(
    async ({ email, password, name, phone, licenseNo, verifyTicket }) => {
      const r = await auth.signUp({ email, password, name, phone, licenseNo, verifyTicket })
      return r.error ? { error: r.error } : { ok: true }
    },
    [],
  )

  // ── 가입 인증 코드 확인 (메일로 받은 6자리) ──
  const confirmSignUp = useCallback(async ({ email, code }) => {
    const r = await auth.confirmSignUp({ email, code })
    return r.error ? { error: r.error } : { ok: true }
  }, [])

  // ── 이메일 로그인 (autoLogin: 체크 시 브라우저 재시작 후에도 로그인 유지 + 아이디 기억) ──
  const applyLoginPrefs = useCallback((email, autoLogin) => {
    localStorage.setItem(AUTOLOGIN_KEY, autoLogin ? '1' : '0')
    sessionStorage.setItem(TAB_KEY, '1')
    if (autoLogin) localStorage.setItem(SAVED_EMAIL_KEY, email)
    else localStorage.removeItem(SAVED_EMAIL_KEY)
  }, [])

  // ── 구글 로그인/가입 — Hosted UI 로 이동한다 (성공 시 사이트로 복귀해 자동 로그인)
  const signInWithGoogle = useCallback(async () => {
    // 리디렉션으로 페이지를 떠나므로, 복귀 후 세션이 유지되도록 미리 저장한다
    localStorage.setItem(AUTOLOGIN_KEY, '1')
    sessionStorage.setItem(TAB_KEY, '1')
    return auth.signInWithGoogle()
  }, [])

  // ── 네이버 로그인/가입 — 네이버 인증 후 백엔드가 Cognito 토큰을 발급한다
  const signInWithNaver = useCallback(async () => {
    localStorage.setItem(AUTOLOGIN_KEY, '1')
    sessionStorage.setItem(TAB_KEY, '1')
    return auth.signInWithNaver()
  }, [])

  // ── 소셜 가입 2/2 폼 제출 (유형·면허·이름·휴대폰) — 본인 회원 정보 갱신
  const completeSocialProfile = useCallback(
    async ({ memberType, licenseNo, name, phone, verifyTicket }) => {
      const r = await apiSend('POST', '/members/complete-profile', {
        memberType,
        licenseNo,
        name,
        phone,
        verifyTicket,
      })
      if (r.error) return { error: r.error }
      setProfilePending(false)
      setUser((cur) => (cur ? { ...cur, name } : cur))
      return { ok: true }
    },
    [],
  )

  const signInWithEmail = useCallback(
    async ({ email, password, autoLogin = true }) => {
      const r = await auth.signIn({ email, password })
      if (r.error) return { error: r.error }
      // 임시 비밀번호 계정 — 아직 로그인 전이므로 설정을 저장하지 않고 챌린지를 그대로 넘긴다
      if (r.challenge) return r
      applyLoginPrefs(email, autoLogin)
      return { ok: true }
    },
    [applyLoginPrefs],
  )

  // ── 임시 비밀번호 첫 로그인 마무리 (새 비밀번호 설정 + 로그인 완료) ──
  const completeNewPassword = useCallback(
    async ({ email, password, session, autoLogin = true }) => {
      const r = await auth.completeNewPassword({ email, password, session })
      if (r.error) return { error: r.error }
      applyLoginPrefs(email, autoLogin)
      return { ok: true }
    },
    [applyLoginPrefs],
  )

  // 저장된 아이디(이메일)/자동 로그인 설정 조회 — 로그인 폼 프리필용
  const getLoginPrefs = useCallback(
    () => ({
      savedEmail: localStorage.getItem(SAVED_EMAIL_KEY) || '',
      autoLogin: localStorage.getItem(AUTOLOGIN_KEY) !== '0',
    }),
    [],
  )

  // ── 인증 코드 재발송 ──
  const resendVerification = useCallback(async (email) => {
    const r = await auth.resendCode(email)
    return r.error ? { error: r.error } : { ok: true }
  }, [])

  // ── 비밀번호 재설정 코드 메일 발송 ──
  const requestPasswordReset = useCallback(async (email) => {
    const r = await auth.forgotPassword(email)
    return r.error ? { error: r.error } : { ok: true }
  }, [])

  // ── 재설정 코드 + 새 비밀번호 확정 ──
  const confirmPasswordReset = useCallback(async ({ email, code, password }) => {
    const r = await auth.confirmForgotPassword({ email, code, password })
    return r.error ? { error: r.error } : { ok: true }
  }, [])

  const logout = useCallback(async () => {
    await auth.signOut()
    setUser(null)
  }, [])

  // notice: 로그인 창에 함께 띄울 안내 문구 (onClick 핸들러로 직접 쓰면 이벤트 객체가 오므로 문자열만 채택)
  const openLogin = useCallback((notice) => {
    setLoginNotice(typeof notice === 'string' ? notice : '')
    setLoginOpen(true)
  }, [])
  const closeLogin = useCallback(() => setLoginOpen(false), [])

  return (
    <UserContext.Provider
      value={{
        user,
        authReady,
        loginOpen,
        loginNotice,
        profilePending,
        openLogin,
        closeLogin,
        logout,
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
      }}
    >
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  return useContext(UserContext)
}

// 회원유형: 의사(의사면허 보유자·모든 서비스) / 병원(병원·의원 소속 관계자) / 일반
// 매거진 열람 권한 판정 — 의사 회원 + 관리자/운영자(admin 그룹)
// 관리자·운영자는 등급과 무관하게 모든 회원 메뉴에 진입할 수 있어야 한다.
export function canReadMagazine(user) {
  return !!user && (user.isAdmin || user.grade === '의사')
}
