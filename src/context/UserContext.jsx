/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import * as auth from '../lib/authClient'
import { apiGet } from '../lib/api'

// 공개 사이트 로그인 세션 (AWS Cognito 이메일 인증)
const UserContext = createContext(null)
const AUTOLOGIN_KEY = 'medifront_autologin' // '0'이면 브라우저 종료 시 로그아웃
const TAB_KEY = 'medifront_tab' // sessionStorage — 브라우저(탭 세션) 생존 마커
const SAVED_EMAIL_KEY = 'medifront_saved_email' // 아이디(이메일) 기억

// Cognito user → 사이트 공용 user 형태 { name, email, grade }
function mapAuthUser(u) {
  if (!u) return null
  return {
    name: u.name || u.email?.split('@')[0] || '회원',
    email: u.email,
    grade: u.grade || '일반',
  }
}

// members 테이블의 등급이 있으면 우선 적용 — 관리자 화면에서 변경한 등급이 실권한에 반영됨
// (API 미설정 등 조회 실패 시 가입 메타데이터 등급 유지)
async function withDbGrade(u) {
  if (!u) return null
  const rows = await apiGet('/members', { email: u.email })
  const grade = rows?.[0]?.grade
  if (!grade) return u
  return { ...u, grade }
}

export function UserProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loginOpen, setLoginOpen] = useState(false)
  const [loginNotice, setLoginNotice] = useState('') // 로그인 창 상단 안내 문구

  // 저장된 세션 복원 (자동 로그인 꺼진 상태에서 브라우저를 새로 연 경우에는 세션 종료)
  useEffect(() => {
    let unsub
    const init = async () => {
      const keepLogin = localStorage.getItem(AUTOLOGIN_KEY) !== '0'
      const newBrowserSession = !sessionStorage.getItem(TAB_KEY)
      sessionStorage.setItem(TAB_KEY, '1')
      if (!keepLogin && newBrowserSession) {
        await auth.signOut()
      }
      // 등급 DB 조회가 끝나기 전에도 기본 정보로 먼저 표시하고, 조회 후 등급만 보정
      const applyUser = (base) => {
        setUser(base)
        if (base) {
          withDbGrade(base).then((u2) =>
            setUser((cur) => (cur && u2 && cur.email === u2.email ? u2 : cur)),
          )
        }
      }
      const session = await auth.getSession()
      applyUser(mapAuthUser(session))
      unsub = auth.onAuthChange((u) => applyUser(mapAuthUser(u)))
    }
    init()
    return () => unsub?.()
  }, [])

  // ── 이메일 회원가입 (인증 코드 메일 발송) — 이름/휴대폰번호/회원유형은 2단계에서 수집 ──
  const signUpWithEmail = useCallback(async ({ email, password, name, phone, grade }) => {
    const r = await auth.signUp({ email, password, name, phone, grade: grade || '일반' })
    return r.error ? { error: r.error } : { ok: true }
  }, [])

  // ── 가입 인증 코드 확인 (메일로 받은 6자리) ──
  const confirmSignUp = useCallback(async ({ email, code }) => {
    const r = await auth.confirmSignUp({ email, code })
    return r.error ? { error: r.error } : { ok: true }
  }, [])

  // ── 이메일 로그인 (autoLogin: 체크 시 브라우저 재시작 후에도 로그인 유지 + 아이디 기억) ──
  const signInWithEmail = useCallback(async ({ email, password, autoLogin = true }) => {
    const r = await auth.signIn({ email, password })
    if (r.error) return { error: r.error }
    localStorage.setItem(AUTOLOGIN_KEY, autoLogin ? '1' : '0')
    sessionStorage.setItem(TAB_KEY, '1')
    if (autoLogin) localStorage.setItem(SAVED_EMAIL_KEY, email)
    else localStorage.removeItem(SAVED_EMAIL_KEY)
    return { ok: true }
  }, [])

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
        loginOpen,
        loginNotice,
        openLogin,
        closeLogin,
        logout,
        signUpWithEmail,
        confirmSignUp,
        signInWithEmail,
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
// 매거진 열람 권한 판정 — 의사 회원 전용
export function canReadMagazine(user) {
  return !!user && user.grade === '의사'
}
