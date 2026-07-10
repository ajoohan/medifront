/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

// 공개 사이트 로그인 세션.
// - Supabase 설정 시: 실제 인증(이메일 가입+인증 메일, 구글/애플 OAuth)
// - 미설정 시: 데모 로그인(등급 선택) 폴백
const UserContext = createContext(null)
const DEMO_KEY = 'medifront_user'

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
  useEffect(() => {
    if (!isSupabaseConfigured) return
    supabase.auth.getSession().then(({ data }) => setUser(mapSupabaseUser(data.session?.user)))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(mapSupabaseUser(session?.user))
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  // ── 데모 로그인 (백엔드 미연결 시) ──
  const demoLogin = useCallback((u) => {
    localStorage.setItem(DEMO_KEY, JSON.stringify(u))
    setUser(u)
  }, [])

  // ── 이메일 회원가입 (인증 메일 발송) ──
  const signUpWithEmail = useCallback(async ({ name, email, password }) => {
    if (!isSupabaseConfigured) return { error: 'not-configured' }
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, grade: '일반' },
        emailRedirectTo: window.location.origin,
      },
    })
    if (error) return { error: error.message }
    // 이미 가입된 이메일이면 identities가 빈 배열로 옴
    if (data.user && data.user.identities?.length === 0) return { error: 'already-registered' }
    return { ok: true }
  }, [])

  // ── 이메일 로그인 ──
  const signInWithEmail = useCallback(async ({ email, password }) => {
    if (!isSupabaseConfigured) return { error: 'not-configured' }
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return error ? { error: error.message } : { ok: true }
  }, [])

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
      }}
    >
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  return useContext(UserContext)
}
