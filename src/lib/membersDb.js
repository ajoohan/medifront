// 회원 목록 DB (Supabase public.members 테이블)
// 테이블 생성 SQL: supabase/members-setup.sql (Supabase 대시보드 > SQL Editor 에서 1회 실행)
import { supabase, isSupabaseConfigured } from './supabase'

const TABLE = 'members'

function toRow(m) {
  return {
    name: m.name,
    email: m.email,
    phone: m.phone,
    hospital: m.hospital,
    specialty: m.specialty,
    grade: m.grade,
    status: m.status,
    joined_at: m.joinedAt,
  }
}

function fromRow(r) {
  return {
    id: r.id,
    name: r.name || '',
    email: r.email,
    phone: r.phone || '-',
    hospital: r.hospital || '-',
    specialty: r.specialty || '-',
    grade: r.grade || '일반',
    joinedAt: r.joined_at,
    status: r.status || 'active',
  }
}

// 목록 조회 — 테이블 미생성 등으로 사용 불가하면 null 반환 (호출부에서 목업 폴백)
export async function fetchMembers() {
  if (!isSupabaseConfigured) return null
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('joined_at', { ascending: false })
    .order('id', { ascending: false })
  if (error) return null
  return data.map(fromRow)
}

// 추가/갱신 — 가입 트리거가 먼저 넣은 행이 있으면 이메일 기준으로 병합
export async function upsertMember(member) {
  const { data, error } = await supabase
    .from(TABLE)
    .upsert(toRow(member), { onConflict: 'email' })
    .select()
    .single()
  return error ? { error: error.message } : { ok: true, member: fromRow(data) }
}

// 등급/상태 변경
export async function updateMemberDb(id, patch) {
  const row = {}
  if (patch.grade) row.grade = patch.grade
  if (patch.status) row.status = patch.status
  const { error } = await supabase.from(TABLE).update(row).eq('id', id)
  return error ? { error: error.message } : { ok: true }
}

export async function deleteMemberDb(id) {
  const { error } = await supabase.from(TABLE).delete().eq('id', id)
  return error ? { error: error.message } : { ok: true }
}
