import { useEffect } from 'react'
import { useUser } from '../../context/UserContext'
import AdminLogin from './AdminLogin'
import AdminDashboard from './AdminDashboard'

// ─────────────────────────────────────────────────────────────
// 관리자 화면 진입점
//
// 이전 구현은 VITE_ADMIN_EMAIL / VITE_ADMIN_PASSWORD 를 브라우저에서 문자열
// 비교하는 프론트엔드 전용 인증이었고, 그 값이 공개 JS 에 평문 노출됐습니다.
// 이제는 AWS Cognito 가 인증하고, 관리자 권한은 서버가 서명한 JWT 의 역할
// 그룹(super-admin / admin / operator)으로만 판정합니다.
//
// ⚠️ 이 화면의 가드는 편의용입니다 — 실제 방어선은 서버입니다.
//    Lambda 가 모든 관리 API 요청마다 JWT 의 그룹을 다시 검증하므로
//    (backend/src/index.mjs 의 getAuth), 이 컴포넌트를 우회해도
//    데이터에는 접근할 수 없습니다.
// ─────────────────────────────────────────────────────────────

export default function AdminPage() {
  const { user, authReady, logout } = useUser()

  useEffect(() => {
    const prev = document.title
    document.title = '메디프론트 MEDIFRONT | 관리자 화면'
    return () => {
      document.title = prev
    }
  }, [])

  // 세션 복원 전에는 user 가 null 이어도 '비로그인'이 아니라 '아직 모름' —
  // 여기서 구분하지 않으면 새로고침 때 로그인 화면이 깜빡인다.
  if (!authReady) {
    return (
      <div className="admin-login">
        <div className="admin-login__card">
          <div className="admin-login__brand">
            <span>ADMIN</span>
          </div>
          <p className="admin-login__sub">확인 중...</p>
        </div>
      </div>
    )
  }

  if (!user) return <AdminLogin />

  // 로그인은 됐지만 관리자가 아닌 경우 (일반 회원이 /admin 을 직접 연 상황)
  if (!user.isAdmin) {
    return (
      <div className="admin-login">
        <div className="admin-login__card">
          <div className="admin-login__brand">
            <span>ADMIN</span>
          </div>
          <p className="admin-login__sub">접근 권한 없음</p>
          <div className="admin-login__error" style={{ textAlign: 'left', lineHeight: 1.7 }}>
            <b>{user.name}</b> 님({user.email})은 관리자 권한이 없습니다.
            <br />
            관리자 계정으로 로그인해 주세요.
          </div>
        </div>
      </div>
    )
  }

  return <AdminDashboard onLogout={logout} />
}
