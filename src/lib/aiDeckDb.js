// PPT 내용 AI 다듬기 — 서버 경유
//
// ⚠️ API 키는 Lambda 환경변수에만 있다. 브라우저에서 직접 부르면 키가 공개되므로,
// 장표 글을 서버로 보내 다듬은 결과만 받아온다.
import { apiGet, apiSend, isApiConfigured } from './api'

// 한 번에 보내는 장 수. API Gateway 가 30초에 연결을 끊으므로, 큰 자료를 통째로
// 보내면 모델이 끝내기 전에 잘린다. 나눠 보내면 장 수와 무관하게 안정적이다.
const BATCH = 5

// 동시에 보내는 묶음 수. 차례대로 보내면 묶음 수만큼 시간이 곱해져
// 큰 자료는 1분을 넘긴다. 서로 딸린 데가 없는 작업이라 겹쳐 보내도 되고,
// 그래도 사용량 한도에 걸리지 않을 만큼만 늘린다.
const CONCURRENCY = 3

// AI 변환을 쓸 수 있는 상태인지 (키가 서버에 등록돼 있는지)
export async function fetchAiEnabled() {
  if (!isApiConfigured) return false
  const r = await apiGet('/ai/config')
  return !!r?.enabled
}

// slides: [{ title, lines }] → 다듬어진 [{ title, lead, points }]
//
// onProgress(done, total) 로 진행 상황을 알린다 — 여러 번 나눠 부르므로
// 화면이 멈춘 것처럼 보이지 않게 한다.
export async function formatDeckWithAi(slides, onProgress) {
  const batches = []
  for (let i = 0; i < slides.length; i += BATCH) {
    batches.push(slides.slice(i, i + BATCH).map((s) => ({ title: s.title, lines: s.lines })))
  }

  // 결과는 보낸 자리에 그대로 넣는다 — 겹쳐 보내면 끝나는 순서가 뒤섞이는데,
  // 장 순서가 바뀌면 안 되기 때문이다.
  const results = new Array(batches.length)
  let taken = 0 // 다음에 가져갈 묶음
  let done = 0 // 끝낸 묶음 수 (진행 표시용)
  let failed = null

  async function worker() {
    for (;;) {
      // 하나라도 실패하면 나머지는 보내지 않는다. 이미 다듬은 부분과 원본이
      // 섞이면 무엇이 AI를 거쳤는지 알 수 없어 확인하고 등록하기 어려워진다.
      if (failed) return
      const i = taken++
      if (i >= batches.length) return

      const r = await apiSend('POST', '/ai/format-deck', { slides: batches[i] })
      if (r.error) {
        failed = failed || { error: r.error, detail: r.detail || '' }
        return
      }
      if (!Array.isArray(r.data?.slides)) {
        failed = failed || { error: 'bad-response' }
        return
      }
      results[i] = r.data.slides
      done += 1
      onProgress?.(Math.min(done * BATCH, slides.length), slides.length)
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, batches.length) }, worker))
  if (failed) return failed
  return { ok: true, slides: results.flat() }
}

// 화면에 보여줄 오류 문구 — 원인별로 다음 행동이 달라진다
export function aiErrorMessage(code) {
  if (code === 'ai-not-configured')
    return 'AI 변환이 아직 설정되지 않았습니다. API 키를 서버에 등록해 주세요.'

  // 서비스가 달라도 숫자(HTTP 상태)의 뜻은 같다
  const status = /-(\d{3})$/.exec(code)?.[1]
  if (status === '401' || status === '403')
    return 'API 키가 거부되었습니다. 키가 올바른지 확인해 주세요.'
  if (status === '429') return '사용량 한도를 넘었습니다. 잠시 후 다시 시도해 주세요.'
  if (status === '400') return '요청이 거부되었습니다. 아래 사유를 확인해 주세요.'

  if (code.endsWith('-bad-format')) return 'AI 응답을 해석하지 못했습니다. 다시 시도해 주세요.'
  if (code.endsWith('-unreachable')) return 'AI 서버에 연결하지 못했습니다.'
  if (code === 'claude-refusal')
    return '이 내용은 AI가 처리를 거절했습니다. 해당 장을 빼고 다시 시도해 주세요.'
  return `AI 변환에 실패했습니다 (${code}).`
}
