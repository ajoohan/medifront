// 대면 상담 회의록 DB (Supabase public.consults 테이블)
// 테이블 생성 SQL: supabase/setup-3.sql
import { supabase, isSupabaseConfigured } from './supabase'

const TABLE = 'consults'

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

// 목록 (최신순) — 테이블 미생성 시 null (호출부에서 브라우저 저장 폴백)
export async function fetchConsultsDb() {
  if (!isSupabaseConfigured) return null
  const { data, error } = await supabase.from(TABLE).select('*').order('id', { ascending: false })
  if (error) return null
  return data.map(fromRow)
}

export async function insertConsultDb(consult) {
  const { data, error } = await supabase.from(TABLE).insert(toRow(consult)).select().single()
  return error ? { error: error.message } : { ok: true, consult: fromRow(data) }
}

export async function updateConsultDb(id, consult) {
  const { error } = await supabase.from(TABLE).update(toRow(consult)).eq('id', id)
  return error ? { error: error.message } : { ok: true }
}

export async function deleteConsultDb(id) {
  const { error } = await supabase.from(TABLE).delete().eq('id', id)
  return error ? { error: error.message } : { ok: true }
}
