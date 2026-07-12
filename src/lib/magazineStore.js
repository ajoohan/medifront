// 매거진 글 저장소 — articles 테이블(DB) 미생성 시의 브라우저 폴백.
const KEY = 'medifront_magazine'

export function loadArticles() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY))
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

// 저장 성공 여부 반환 — 브라우저 저장소 용량 초과(QuotaExceeded) 시 false
export function saveArticles(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
    return true
  } catch {
    return false
  }
}
