import { useEffect } from 'react'

// ─────────────────────────────────────────────────────────────
// 🔒 관리자 화면 일시 비활성화 (보안 조치)
//
// 배경: 이전 구현은 VITE_ADMIN_EMAIL / VITE_ADMIN_PASSWORD 를 브라우저에서
//       문자열 비교하는 프론트엔드 전용 인증이었습니다. Vite 는 VITE_ 접두사
//       변수를 설계상 클라이언트 번들에 그대로 삽입하므로, 관리자 비밀번호가
//       공개 JS 파일에 평문으로 노출됐습니다. 비밀번호를 바꿔도 새 값이 즉시
//       다시 공개되므로 이 구조로는 어떤 비밀번호도 안전할 수 없습니다.
//
// 조치: 자격증명을 코드에서 완전히 제거하고, 서버 검증(AWS Cognito) 전환
//       전까지 /admin 로그인을 닫습니다. AdminLogin/AdminDashboard 를
//       import 하지 않으므로 관리자 화면 코드 자체도 번들에서 제외됩니다.
//
// 그동안 관리 작업은 Supabase 대시보드에서 수행하세요.
// 전환 후 이 파일은 Cognito 인증(서버 검증 JWT)으로 다시 열립니다.
// ─────────────────────────────────────────────────────────────

export default function AdminPage() {
  useEffect(() => {
    const prev = document.title
    document.title = '메디프론트 MEDIFRONT | 관리자 화면'
    return () => {
      document.title = prev
    }
  }, [])

  return (
    <div className="admin-login">
      <div className="admin-login__card">
        <div className="admin-login__brand">
          <span>ADMIN</span>
        </div>
        <p className="admin-login__sub">관리자 화면 점검 중</p>
        <div className="admin-login__error" style={{ textAlign: 'left', lineHeight: 1.7 }}>
          보안 강화 작업(서버 인증 전환)으로 관리자 로그인을 일시적으로 닫았습니다.
          <br />
          작업이 완료되면 다시 열립니다.
        </div>
      </div>
    </div>
  )
}
