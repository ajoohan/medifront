// PPT 내용 AI 다듬기 (Gemini) — 서버 경유
//
// ⚠️ Gemini API 키는 Lambda 환경변수에만 있다. 브라우저에서 직접 부르면 키가
// 공개되므로, 장표 글을 서버로 보내 다듬은 결과만 받아온다.
import { apiGet, apiSend, isApiConfigured } from './api'

// AI 변환을 쓸 수 있는 상태인지 (키가 서버에 등록돼 있는지)
export async function fetchAiEnabled() {
  if (!isApiConfigured) return false
  const r = await apiGet('/ai/config')
  return !!r?.enabled
}

// slides: [{ title, lines }] → 다듬어진 [{ title, lead, points }]
export async function formatDeckWithAi(slides) {
  const payload = slides.map((s) => ({ title: s.title, lines: s.lines }))
  const r = await apiSend('POST', '/ai/format-deck', { slides: payload })
  if (r.error) return { error: r.error }
  if (!Array.isArray(r.data?.slides)) return { error: 'bad-response' }
  return { ok: true, slides: r.data.slides }
}

// 화면에 보여줄 오류 문구 — 원인별로 다음 행동이 달라진다
export function aiErrorMessage(code) {
  if (code === 'ai-not-configured')
    return 'AI 변환이 아직 설정되지 않았습니다. Gemini API 키를 서버에 등록해 주세요.'
  if (code === 'gemini-401' || code === 'gemini-403')
    return 'Gemini API 키가 거부되었습니다. 키가 올바른지 확인해 주세요.'
  if (code === 'gemini-429') return 'Gemini 사용량 한도를 넘었습니다. 잠시 후 다시 시도해 주세요.'
  if (code === 'gemini-bad-format') return 'AI 응답을 해석하지 못했습니다. 다시 시도해 주세요.'
  if (code === 'gemini-unreachable') return 'Gemini 서버에 연결하지 못했습니다.'
  return `AI 변환에 실패했습니다 (${code}).`
}
