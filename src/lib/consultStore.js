// 대면 상담 기록 저장소 (localStorage) — 실제 DB 연동 전 임시
const KEY = 'medifront_consults'

export function loadConsults() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || []
  } catch {
    return []
  }
}

// 이미지·첨부파일(dataURL) 포함으로 용량이 클 수 있어 저장 성공 여부를 반환
export function saveConsults(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
    return true
  } catch {
    return false
  }
}
