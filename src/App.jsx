import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import Header from './components/Header'
import Footer from './components/Footer'
import ScrollToTop from './components/ScrollToTop'
import LoginModal from './components/LoginModal'
import FloatingInquiry from './components/FloatingInquiry'
import HomePage from './pages/HomePage'
import MagazinePage from './pages/MagazinePage'
import MagazineDetailPage from './pages/MagazineDetailPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import TermsPage from './pages/TermsPage'
import PrivacyPage from './pages/PrivacyPage'
import NotFoundPage from './pages/NotFoundPage'
import { useUser } from './context/UserContext'

// 관리자 화면(회원·상담·매거진·설정)은 운영자만 쓰는데 정적 import 하면 모든 방문자의
// 번들에 함께 실린다. lazy 로 분리해 /admin 에 들어갈 때만 내려받는다.
const AdminPage = lazy(() => import('./pages/admin/AdminPage'))

function Shell() {
  const { pathname } = useLocation()
  // 대소문자 무관 판정 (/ADMIN 등으로 접속해도 헤더/푸터 숨김)
  const isAdmin = pathname.toLowerCase().startsWith('/admin')
  const { loginOpen, closeLogin } = useUser()

  return (
    <>
      <ScrollToTop />
      {!isAdmin && <Header />}
      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/magazine" element={<MagazinePage />} />
          <Route path="/magazine/:id" element={<MagazineDetailPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route
            path="/admin"
            element={
              <Suspense fallback={null}>
                <AdminPage />
              </Suspense>
            }
          />
          {/* 그 외 모든 주소 — 빈 화면 대신 404 안내 */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
      {!isAdmin && <Footer />}
      {!isAdmin && <FloatingInquiry />}
      <LoginModal open={loginOpen} onClose={closeLogin} />
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Shell />
    </BrowserRouter>
  )
}
