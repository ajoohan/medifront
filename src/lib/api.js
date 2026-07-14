// 데이터 API 클라이언트 — AWS Lambda(HTTP API) 호출 공통 래퍼
import { awsConfig, isApiConfigured } from './awsConfig'

export { isApiConfigured }

// 조회 — 실패(미설정·네트워크·서버 오류) 시 null 반환 → 호출부에서 목업 폴백
export async function apiGet(path, params) {
  if (!isApiConfigured) return null
  try {
    const qs = params ? `?${new URLSearchParams(params)}` : ''
    const res = await fetch(`${awsConfig.apiBaseUrl}${path}${qs}`)
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

// 쓰기 — { ok, data } 또는 { error: 메시지 }
export async function apiSend(method, path, body) {
  if (!isApiConfigured) return { error: 'not-configured' }
  try {
    const res = await fetch(`${awsConfig.apiBaseUrl}${path}`, {
      method,
      headers: { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return { error: data.error || `HTTP ${res.status}` }
    return { ok: true, data }
  } catch (e) {
    return { error: e.message || 'network error' }
  }
}
