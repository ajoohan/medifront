import { useState } from 'react'
import AdminLogin from './AdminLogin'
import AdminDashboard from './AdminDashboard'

// ⚠️ 프론트엔드 전용 목업 인증(프로토타입). 실제 보안이 아니며 운영용이 아닙니다.
const AUTH_KEY = 'medifront_admin_auth'

export default function AdminPage() {
  const [authed, setAuthed] = useState(() => localStorage.getItem(AUTH_KEY) === '1')

  const onLogin = () => {
    localStorage.setItem(AUTH_KEY, '1')
    setAuthed(true)
  }
  const onLogout = () => {
    localStorage.removeItem(AUTH_KEY)
    setAuthed(false)
  }

  if (!authed) return <AdminLogin onLogin={onLogin} />
  return <AdminDashboard onLogout={onLogout} />
}
