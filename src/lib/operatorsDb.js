// 운영자 목록 DB (AWS DynamoDB operators — Lambda API 경유)
import { apiGet, apiSend, isApiConfigured } from './api'

const PATH = '/operators'

function fromRow(r) {
  return {
    id: r.id,
    name: r.name || '',
    email: r.email,
    phone: r.phone || '-',
    grade: r.grade || '운영자',
    createdAt: (r.created_at || '').slice(0, 10),
  }
}

// 목록 — API 미설정/오류 시 null (호출부에서 브라우저 저장 폴백)
export async function fetchOperatorsDb() {
  if (!isApiConfigured) return null
  const data = await apiGet(PATH)
  if (!data) return null
  return data.sort((a, b) => b.id - a.id).map(fromRow)
}

export async function insertOperatorDb(op) {
  const row = { name: op.name, email: op.email, phone: op.phone, grade: op.grade }
  // 브라우저 저장분 이전 시 원래 등록일 유지
  if (op.createdAt) row.created_at = `${op.createdAt}T00:00:00Z`
  const r = await apiSend('POST', PATH, row)
  return r.error ? { error: r.error } : { ok: true, operator: fromRow(r.data) }
}

export async function updateOperatorDb(id, patch) {
  const row = {}
  if (patch.grade !== undefined) row.grade = patch.grade
  const r = await apiSend('PATCH', `${PATH}/${id}`, row)
  return r.error ? { error: r.error } : { ok: true }
}

export async function deleteOperatorDb(id) {
  const r = await apiSend('DELETE', `${PATH}/${id}`)
  return r.error ? { error: r.error } : { ok: true }
}
