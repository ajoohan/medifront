import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Header from './components/Header'
import Footer from './components/Footer'
import ScrollToTop from './components/ScrollToTop'
import HomePage from './pages/HomePage'
import MagazinePage from './pages/MagazinePage'

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Header />
      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/magazine" element={<MagazinePage />} />
        </Routes>
      </main>
      <Footer />
    </BrowserRouter>
  )
}
