// 성과 데이터 DB (Supabase public.performances 테이블)
// 테이블 생성 SQL: supabase/setup-5.sql
import { supabase, isSupabaseConfigured } from './supabase'

const TABLE = 'performances'

function fromRow(r) {
  return {
    id: r.id,
    hospital: r.hospital,
    size: r.size || '',
    openingYear: r.opening_year,
  }
}

// 목록 (등록순) — 테이블 미생성 시 null (호출부에서 RESULTS 폴백)
export async function fetchPerformances() {
  if (!isSupabaseConfigured) return null
  const { data, error } = await supabase.from(TABLE).select('*').order('id', { ascending: true })
  if (error) return null
  return data.map(fromRow)
}

export async function insertPerformance({ hospital, size, openingYear }) {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({ hospital, size, opening_year: openingYear })
    .select()
    .single()
  return error ? { error: error.message } : { ok: true, performance: fromRow(data) }
}

export async function deletePerformance(id) {
  const { error } = await supabase.from(TABLE).delete().eq('id', id)
  return error ? { error: error.message } : { ok: true }
}
