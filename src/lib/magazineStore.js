// 매거진 글 저장소 (프로토타입) — localStorage에 보관해
// 관리자에서 등록/수정한 글이 공개 매거진 페이지에도 반영됩니다.
// 실제 운영 시에는 백엔드(DB) API로 교체하세요.
import { MAGAZINE } from '../data'

const KEY = 'medifront_magazine'

export function loadArticles() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length >= 0) return parsed
    }
  } catch {
    /* 손상된 데이터는 무시하고 기본값 사용 */
  }
  // 최초 실행: 기본 샘플에 id/status 부여
  return MAGAZINE.map((a, i) => ({ id: i + 1, status: 'visible', ...a }))
}

export function saveArticles(list) {
  localStorage.setItem(KEY, JSON.stringify(list))
}
