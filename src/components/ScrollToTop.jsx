import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

// 라우트 변경 시 최상단으로 스크롤 (해시가 있으면 해당 요소로 스크롤)
export default function ScrollToTop() {
  const { pathname, hash } = useLocation()

  useEffect(() => {
    if (hash) {
      const el = document.querySelector(hash)
      if (el) {
        el.scrollIntoView()
        return
      }
    }
    window.scrollTo(0, 0)
  }, [pathname, hash])

  return null
}
