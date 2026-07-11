// 운영자 목록 저장소 (localStorage) — 실제 DB 연동 전 임시
// 등급: 마스터(전체 권한) / 매니저
const KEY = 'medifront_operators'

export function loadOperators() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || []
  } catch {
    return []
  }
}

export function saveOperators(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
    return true
  } catch {
    return false
  }
}
