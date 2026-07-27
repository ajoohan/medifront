// 컨설팅 자료 노출 설정 DB (AWS DynamoDB consulting_docs — Lambda API 경유)
//
// 자료 본문은 정적(consultingDocs.js + public/*.html)이고, 여기서는 "숨김 여부"만 다룬다.
// 행이 아직 없는 자료는 노출(hidden=false)로 본다 — 새 자료를 추가해도 곧바로 보인다.
import { apiGet, apiSend, isApiConfigured } from './api'

const PATH = '/consulting-docs'

// 헤더 배지와 목록 화면이 같은 값을 쓰므로 요청을 한 번만 보낸다.
// 관리자가 노출을 바꾸면 invalidateDocFlags() 로 캐시를 버린다.
let cached = null
export function loadDocFlags() {
  if (!cached) cached = fetchDocFlags()
  return cached
}
export function invalidateDocFlags() {
  cached = null
}

// doc_id -> { rowId, hidden }
// API 미설정/오류 시 null (호출부에서 '전부 노출'로 폴백)
export async function fetchDocFlags() {
  if (!isApiConfigured) return null
  const rows = await apiGet(PATH)
  if (!rows) return null
  const map = {}
  for (const r of rows) map[r.doc_id] = { rowId: r.id, hidden: !!r.hidden }
  return map
}

// 노출 여부 저장 — 행이 있으면 수정, 없으면 생성
export async function setDocHidden(docId, hidden, rowId) {
  const res = rowId
    ? await apiSend('PATCH', `${PATH}/${rowId}`, { hidden })
    : await apiSend('POST', PATH, { doc_id: docId, hidden })
  if (res.error) return { error: res.error }
  return { ok: true, rowId: res.data?.id ?? rowId }
}

// 정적 목록 + 노출 설정 → 방문자에게 보여줄 목록
export function visibleDocs(docs, flags) {
  if (!flags) return docs
  return docs.filter((d) => !flags[d.id]?.hidden)
}
