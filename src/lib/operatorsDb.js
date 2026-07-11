// 운영자 목록 DB (Supabase public.operators 테이블)
// 테이블 생성 SQL: supabase/setup-3.sql
import { supabase, isSupabaseConfigured } from './supabase'

const TABLE = 'operators'

function fromRow(r) {
  return {
    id: r.id,
    name: r.name || '',
    email: r.email,
    phone: r.phone || '-',
    grade: r.grade || '매니저',
    createdAt: (r.created_at || '').slice(0, 10),
  }
}

// 목록 — 테이블 미생성 시 null (호출부에서 브라우저 저장 폴백)
export async function fetchOperatorsDb() {
  if (!isSupabaseConfigured) return null
  const { data, error } = await supabase.from(TABLE).select('*').order('id', { ascending: false })
  if (error) return null
  return data.map(fromRow)
}

export async function insertOperatorDb(op) {
  const row = { name: op.name, email: op.email, phone: op.phone, grade: op.grade }
  // 브라우저 저장분 이전 시 원래 등록일 유지
  if (op.createdAt) row.created_at = `${op.createdAt}T00:00:00Z`
  const { data, error } = await supabase.from(TABLE).insert(row).select().single()
  return error ? { error: error.message } : { ok: true, operator: fromRow(data) }
}

export async function updateOperatorDb(id, patch) {
  const row = {}
  if (patch.grade !== undefined) row.grade = patch.grade
  const { error } = await supabase.from(TABLE).update(row).eq('id', id)
  return error ? { error: error.message } : { ok: true }
}

export async function deleteOperatorDb(id) {
  const { error } = await supabase.from(TABLE).delete().eq('id', id)
  return error ? { error: error.message } : { ok: true }
}
