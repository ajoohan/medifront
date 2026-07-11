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
import AdminPage from './pages/admin/AdminPage'
import { useUser } from './context/UserContext'

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
          <Route path="/admin" element={<AdminPage />} />
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
