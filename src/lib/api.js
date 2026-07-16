// 데이터 API 클라이언트 — AWS Lambda(HTTP API) 호출 공통 래퍼
import { awsConfig, isApiConfigured } from './awsConfig'
import { getValidIdToken } from './authClient'

export { isApiConfigured }

// 로그인 상태면 Authorization 헤더(ID 토큰)를 붙인다. 관리자 전용 엔드포인트는
// 이 헤더가 없으면 백엔드 authorizer 가 401 을 반환한다(template.yaml 의 CognitoAuth).
// 공개 엔드포인트(성과·매거진 등)는 토큰이 없어도 그대로 동작한다.
async function authHeaders(base) {
  const token = await getValidIdToken()
  return token ? { ...base, authorization: token } : { ...base }
}

// 조회 — 실패(미설정·네트워크·서버 오류) 시 null 반환 → 호출부에서 목업 폴백
export async function apiGet(path, params) {
  if (!isApiConfigured) return null
  try {
    const qs = params ? `?${new URLSearchParams(params)}` : ''
    const res = await fetch(`${awsConfig.apiBaseUrl}${path}${qs}`, {
      headers: await authHeaders(),
    })
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
      headers: await authHeaders({ 'content-type': 'application/json' }),
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return { error: data.error || `HTTP ${res.status}` }
    return { ok: true, data }
  } catch (e) {
    return { error: e.message || 'network error' }
  }
}
