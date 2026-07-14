// 상담 신청 접수 DB (AWS DynamoDB consult_requests — Lambda API 경유)
import { apiGet, apiSend, isApiConfigured } from './api'

const PATH = '/consult-requests'

function fromRow(r) {
  return {
    id: r.id,
    name: r.name,
    phone: r.phone,
    specialty: r.specialty || '-',
    openingPeriod: r.opening_period || '-',
    openingRegion: r.opening_region || '-',
    message: r.message || '',
    status: r.status || 'new', // new(신규) | done(처리완료)
    createdAt: r.created_at,
  }
}

// 접수 (메인 페이지 상담 신청 폼)
export async function insertRequest(form) {
  if (!isApiConfigured) return { error: 'not-configured' }
  const r = await apiSend('POST', PATH, {
    name: form.name,
    phone: form.phone,
    specialty: form.specialty,
    opening_period: form.openingPeriod,
    opening_region: form.openingRegion,
    message: form.message,
  })
  return r.error ? { error: r.error } : { ok: true }
}

// 접수 목록 (관리자) — API 미설정/오류 시 null
export async function fetchRequests() {
  if (!isApiConfigured) return null
  const data = await apiGet(PATH)
  if (!data) return null
  return data.sort((a, b) => b.id - a.id).map(fromRow)
}

export async function updateRequestStatus(id, status) {
  const r = await apiSend('PATCH', `${PATH}/${id}`, { status })
  return r.error ? { error: r.error } : { ok: true }
}

export async function deleteRequest(id) {
  const r = await apiSend('DELETE', `${PATH}/${id}`)
  return r.error ? { error: r.error } : { ok: true }
}
