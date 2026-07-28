// 내부 자료실 DB (AWS DynamoDB internal_docs — Lambda API 경유)
//
// ⚠️ 관리자·운영자 전용 문서다. 백엔드에서 ADMIN_READ_ONLY_RESOURCES 로 잠가 두었으므로
// 일반 회원 토큰으로는 조회 자체가 403 이다. 공개 화면에서 이 모듈을 쓰지 말 것.
import { apiGet, apiSend, isApiConfigured } from './api'

const PATH = '/internal-docs'

function fromRow(r) {
  return {
    id: r.id,
    title: r.title || '(제목 없음)',
    summary: r.summary || '',
    category: r.category || '운영',
    content: r.content || '',
    createdAt: r.created_at || '',
    updatedAt: r.updated_at || r.created_at || '',
  }
}

// 목록 (최근 수정순) — API 미설정/오류 시 null
export async function fetchInternalDocs() {
  if (!isApiConfigured) return null
  const rows = await apiGet(PATH)
  if (!rows) return null
  return rows.map(fromRow).sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
}

export async function insertInternalDoc({ title, summary, category, content }) {
  const r = await apiSend('POST', PATH, {
    title,
    summary,
    category,
    content,
    updated_at: new Date().toISOString(),
  })
  return r.error ? { error: r.error } : { ok: true, doc: fromRow(r.data) }
}

export async function updateInternalDoc(id, patch) {
  const body = { ...patch, updated_at: new Date().toISOString() }
  const r = await apiSend('PATCH', `${PATH}/${id}`, body)
  return r.error ? { error: r.error } : { ok: true }
}

export async function deleteInternalDoc(id) {
  const r = await apiSend('DELETE', `${PATH}/${id}`)
  return r.error ? { error: r.error } : { ok: true }
}
