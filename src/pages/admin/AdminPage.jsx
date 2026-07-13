import { useCallback, useEffect, useState } from 'react'
import AdminLogin from './AdminLogin'
import AdminDashboard from './AdminDashboard'

// ⚠️ 프론트엔드 전용 목업 인증(프로토타입). 실제 보안은 서버 검증이 필요합니다.
// 세션 정책:
// - sessionStorage 사용 → 브라우저 종료·재부팅 시 세션이 사라져 재로그인 필요
// - 마지막 활동 후 30분(유휴) 초과 시 자동 로그아웃
const AUTH_KEY = 'medifront_admin_auth'
const IDLE_LIMIT = 30 * 60 * 1000 // 30분
const CHECK_INTERVAL = 30 * 1000 // 30초마다 유휴 검사
const WRITE_THROTTLE = 20 * 1000 // 활동 저장은 최대 20초에 한 번

let lastWrite = 0

// 유효한(만료 전) 세션이면 true. 유휴 초과 시 세션 제거 후 false.
function readAuth() {
  try {
    const raw = sessionStorage.getItem(AUTH_KEY)
    if (!raw) return false
    const { lastActivity } = JSON.parse(raw)
    if (!lastActivity || Date.now() - lastActivity > IDLE_LIMIT) {
      sessionStorage.removeItem(AUTH_KEY)
      return false
    }
    return true
  } catch {
    return false
  }
}

// 활동 시각 갱신 (잦은 쓰기 방지를 위해 스로틀)
function touchAuth(force) {
  const now = Date.now()
  if (!force && now - lastWrite < WRITE_THROTTLE) return
  lastWrite = now
  sessionStorage.setItem(AUTH_KEY, JSON.stringify({ lastActivity: now }))
}

export default function AdminPage() {
  const [authed, setAuthed] = useState(readAuth)

  // 관리자 화면 진입 시 브라우저 탭 제목 변경, 벗어나면 원복
  useEffect(() => {
    const prev = document.title
    document.title = '메디프론트 MEDIFRONT | 관리자 화면'
    return () => {
      document.title = prev
    }
  }, [])

  const onLogin = () => {
    touchAuth(true)
    setAuthed(true)
  }
  const onLogout = useCallback(() => {
    sessionStorage.removeItem(AUTH_KEY)
    setAuthed(false)
  }, [])

  // 로그인 상태에서 활동 감지 + 유휴 자동 로그아웃
  useEffect(() => {
    if (!authed) return
    const bump = () => touchAuth()
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart']
    events.forEach((e) => window.addEventListener(e, bump, { passive: true }))
    const timer = setInterval(() => {
      if (!readAuth()) onLogout()
    }, CHECK_INTERVAL)
    return () => {
      events.forEach((e) => window.removeEventListener(e, bump))
      clearInterval(timer)
    }
  }, [authed, onLogout])

  if (!authed) return <AdminLogin onLogin={onLogin} />
  return <AdminDashboard onLogout={onLogout} />
}
