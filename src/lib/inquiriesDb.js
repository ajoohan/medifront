// 1:1 문의 (비공개 게시판) — AWS DynamoDB inquiries (Lambda API 경유)
import { apiGet, apiSend, isApiConfigured } from './api'

const PATH = '/inquiries'

function fromRow(r) {
  return {
    id: r.id,
    email: r.email,
    name: r.name || '',
    title: r.title,
    content: r.content,
    answer: r.answer || '',
    status: r.status || 'open', // open(답변대기) | answered(답변완료)
    createdAt: r.created_at,
    answeredAt: r.answered_at,
  }
}

const byNewest = (a, b) => (b.created_at || '').localeCompare(a.created_at || '')

// 내 문의 목록 (회원용) — API 미설정/오류 시 null
export async function fetchMyInquiries(email) {
  if (!isApiConfigured) return null
  const data = await apiGet(PATH, { email })
  if (!data) return null
  return data.sort(byNewest).map(fromRow)
}

// 전체 문의 목록 (관리자용)
export async function fetchAllInquiries() {
  if (!isApiConfigured) return null
  const data = await apiGet(PATH)
  if (!data) return null
  return data.sort(byNewest).map(fromRow)
}

export async function createInquiry({ email, name, title, content }) {
  const r = await apiSend('POST', PATH, { email, name, title, content })
  return r.error ? { error: r.error } : { ok: true, inquiry: fromRow(r.data) }
}

export async function answerInquiry(id, answer) {
  const r = await apiSend('PATCH', `${PATH}/${id}`, {
    answer,
    status: 'answered',
    answered_at: new Date().toISOString(),
  })
  return r.error ? { error: r.error } : { ok: true }
}

export async function deleteInquiry(id) {
  const r = await apiSend('DELETE', `${PATH}/${id}`)
  return r.error ? { error: r.error } : { ok: true }
}
