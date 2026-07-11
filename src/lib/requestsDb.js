// 상담 신청 접수 DB (Supabase public.consult_requests 테이블)
// 테이블 생성 SQL: supabase/setup-4.sql
import { supabase, isSupabaseConfigured } from './supabase'

const TABLE = 'consult_requests'

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
  if (!isSupabaseConfigured) return { error: 'not-configured' }
  const { error } = await supabase.from(TABLE).insert({
    name: form.name,
    phone: form.phone,
    specialty: form.specialty,
    opening_period: form.openingPeriod,
    opening_region: form.openingRegion,
    message: form.message,
  })
  return error ? { error: error.message } : { ok: true }
}

// 접수 목록 (관리자) — 테이블 미생성 시 null
export async function fetchRequests() {
  if (!isSupabaseConfigured) return null
  const { data, error } = await supabase.from(TABLE).select('*').order('id', { ascending: false })
  if (error) return null
  return data.map(fromRow)
}

export async function updateRequestStatus(id, status) {
  const { error } = await supabase.from(TABLE).update({ status }).eq('id', id)
  return error ? { error: error.message } : { ok: true }
}

export async function deleteRequest(id) {
  const { error } = await supabase.from(TABLE).delete().eq('id', id)
  return error ? { error: error.message } : { ok: true }
}
