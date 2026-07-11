/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

// 공개 사이트 로그인 세션.
// - Supabase 설정 시: 실제 인증(이메일 가입+인증 메일, 구글/애플 OAuth)
// - 미설정 시: 데모 로그인(등급 선택) 폴백
const UserContext = createContext(null)
const DEMO_KEY = 'medifront_user'
const AUTOLOGIN_KEY = 'medifront_autologin' // '0'이면 브라우저 종료 시 로그아웃
const TAB_KEY = 'medifront_tab' // sessionStorage — 브라우저(탭 세션) 생존 마커
const SAVED_EMAIL_KEY = 'medifront_saved_email' // 아이디(이메일) 기억

function readDemoUser() {
  try {
    return JSON.parse(localStorage.getItem(DEMO_KEY)) || null
  } catch {
    return null
  }
}

// Supabase user → 사이트 공용 user 형태 { name, email, grade }
function mapSupabaseUser(u) {
  if (!u) return null
  return {
    name: u.user_metadata?.name || u.email?.split('@')[0] || '회원',
    email: u.email,
    grade: u.user_metadata?.grade || '일반',
  }
}

export function UserProvider({ children }) {
  const [user, setUser] = useState(() => (isSupabaseConfigured ? null : readDemoUser()))
  const [loginOpen, setLoginOpen] = useState(false)

  // Supabase 세션 구독 (OAuth 리다이렉트 복귀·인증 메일 링크 클릭 포함)
  // 자동 로그인 꺼진 상태에서 브라우저를 새로 연 경우에는 세션을 종료한다.
  useEffect(() => {
    if (!isSupabaseConfigured) return
    let sub
    const init = async () => {
      const keepLogin = localStorage.getItem(AUTOLOGIN_KEY) !== '0'
      const newBrowserSession = !sessionStorage.getItem(TAB_KEY)
      sessionStorage.setItem(TAB_KEY, '1')
      if (!keepLogin && newBrowserSession) {
        await supabase.auth.signOut()
      }
      const { data } = await supabase.auth.getSession()
      setUser(mapSupabaseUser(data.session?.user))
      sub = supabase.auth.onAuthStateChange((_event, session) => {
        setUser(mapSupabaseUser(session?.user))
      }).data
    }
    init()
    return () => sub?.subscription.unsubscribe()
  }, [])

  // ── 데모 로그인 (백엔드 미연결 시) ──
  const demoLogin = useCallback((u) => {
    localStorage.setItem(DEMO_KEY, JSON.stringify(u))
    setUser(u)
  }, [])

  // ── 이메일 회원가입 (인증 메일 발송) — 이름/휴대폰번호는 2단계에서 수집 ──
  const signUpWithEmail = useCallback(async ({ email, password, name, phone }) => {
    if (!isSupabaseConfigured) return { error: 'not-configured' }
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, phone, grade: '일반' },
        emailRedirectTo: window.location.origin,
      },
    })
    if (error) return { error: error.message }
    // 이미 가입된 이메일이면 identities가 빈 배열로 옴
    if (data.user && data.user.identities?.length === 0) return { error: 'already-registered' }
    return { ok: true }
  }, [])

  // ── 이메일 로그인 (autoLogin: 체크 시 브라우저 재시작 후에도 로그인 유지 + 아이디 기억) ──
  const signInWithEmail = useCallback(async ({ email, password, autoLogin = true }) => {
    if (!isSupabaseConfigured) return { error: 'not-configured' }
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error: error.message }
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

  // ── 소셜 로그인/가입 (google | apple) ──
  const signInWithProvider = useCallback(async (provider) => {
    if (!isSupabaseConfigured) return { error: 'not-configured' }
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin },
    })
    return error ? { error: error.message } : { ok: true }
  }, [])

  // ── 인증 메일 재발송 ──
  const resendVerification = useCallback(async (email) => {
    if (!isSupabaseConfigured) return { error: 'not-configured' }
    const { error } = await supabase.auth.resend({ type: 'signup', email })
    return error ? { error: error.message } : { ok: true }
  }, [])

  // ── 비밀번호 재설정 메일 발송 ──
  const requestPasswordReset = useCallback(async (email) => {
    if (!isSupabaseConfigured) return { error: 'not-configured' }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    return error ? { error: error.message } : { ok: true }
  }, [])

  // ── 새 비밀번호 설정 (재설정 링크로 들어온 세션에서) ──
  const updatePassword = useCallback(async (password) => {
    if (!isSupabaseConfigured) return { error: 'not-configured' }
    const { error } = await supabase.auth.updateUser({ password })
    return error ? { error: error.message } : { ok: true }
  }, [])

  const logout = useCallback(async () => {
    if (isSupabaseConfigured) await supabase.auth.signOut()
    localStorage.removeItem(DEMO_KEY)
    setUser(null)
  }, [])

  const openLogin = useCallback(() => setLoginOpen(true), [])
  const closeLogin = useCallback(() => setLoginOpen(false), [])

  return (
    <UserContext.Provider
      value={{
        user,
        loginOpen,
        openLogin,
        closeLogin,
        logout,
        authReady: isSupabaseConfigured,
        demoLogin,
        signUpWithEmail,
        signInWithEmail,
        signInWithProvider,
        resendVerification,
        requestPasswordReset,
        updatePassword,
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

// 매거진 열람 권한 판정 (의사/원장 등급만)
export function canReadMagazine(user) {
  return !!user && (user.grade === '의사' || user.grade === '원장')
}
