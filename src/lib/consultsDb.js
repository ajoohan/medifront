// 대면 상담 회의록 DB (AWS DynamoDB consults — Lambda API 경유)
import { apiGet, apiSend, isApiConfigured } from './api'

const PATH = '/consults'

function fromRow(r) {
  return {
    id: r.id,
    fields: {
      datetime: r.datetime || '',
      place: r.place || '',
      doctorName: r.doctor_name || '',
      doctorPhone: r.doctor_phone || '',
      doctorEmail: r.doctor_email || '',
      specialty: r.specialty || '',
      region: r.region || '',
      period: r.period || '',
    },
    content: r.content || '',
  }
}

function toRow({ fields, content }) {
  return {
    datetime: fields.datetime,
    place: fields.place,
    doctor_name: fields.doctorName,
    doctor_phone: fields.doctorPhone,
    doctor_email: fields.doctorEmail,
    specialty: fields.specialty,
    region: fields.region,
    period: fields.period,
    content,
  }
}

// 목록 (최신순) — API 미설정/오류 시 null (호출부에서 브라우저 저장 폴백)
export async function fetchConsultsDb() {
  if (!isApiConfigured) return null
  const data = await apiGet(PATH)
  if (!data) return null
  return data.sort((a, b) => b.id - a.id).map(fromRow)
}

export async function insertConsultDb(consult) {
  const r = await apiSend('POST', PATH, toRow(consult))
  return r.error ? { error: r.error } : { ok: true, consult: fromRow(r.data) }
}

export async function updateConsultDb(id, consult) {
  const r = await apiSend('PATCH', `${PATH}/${id}`, toRow(consult))
  return r.error ? { error: r.error } : { ok: true }
}

export async function deleteConsultDb(id) {
  const r = await apiSend('DELETE', `${PATH}/${id}`)
  return r.error ? { error: r.error } : { ok: true }
}
