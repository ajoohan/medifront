import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import Header from './components/Header'
import Footer from './components/Footer'
import ScrollToTop from './components/ScrollToTop'
import LoginModal from './components/LoginModal'
import HomePage from './pages/HomePage'
import MagazinePage from './pages/MagazinePage'
import AdminPage from './pages/admin/AdminPage'
import { useUser } from './context/UserContext'

function Shell() {
  const { pathname } = useLocation()
  const isAdmin = pathname.startsWith('/admin')
  const { loginOpen, closeLogin } = useUser()

  return (
    <>
      <ScrollToTop />
      {!isAdmin && <Header />}
      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/magazine" element={<MagazinePage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Routes>
      </main>
      {!isAdmin && <Footer />}
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
