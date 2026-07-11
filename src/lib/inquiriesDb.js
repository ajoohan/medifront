// 1:1 문의 (비공개 게시판) — Supabase public.inquiries 테이블
// 테이블 생성 SQL: supabase/setup-2.sql
import { supabase, isSupabaseConfigured } from './supabase'

const TABLE = 'inquiries'

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

// 내 문의 목록 (회원용) — 테이블 미생성 시 null
export async function fetchMyInquiries(email) {
  if (!isSupabaseConfigured) return null
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('email', email)
    .order('created_at', { ascending: false })
  if (error) return null
  return data.map(fromRow)
}

// 전체 문의 목록 (관리자용)
export async function fetchAllInquiries() {
  if (!isSupabaseConfigured) return null
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('created_at', { ascending: false })
  if (error) return null
  return data.map(fromRow)
}

export async function createInquiry({ email, name, title, content }) {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({ email, name, title, content })
    .select()
    .single()
  return error ? { error: error.message } : { ok: true, inquiry: fromRow(data) }
}

export async function answerInquiry(id, answer) {
  const { error } = await supabase
    .from(TABLE)
    .update({ answer, status: 'answered', answered_at: new Date().toISOString() })
    .eq('id', id)
  return error ? { error: error.message } : { ok: true }
}

export async function deleteInquiry(id) {
  const { error } = await supabase.from(TABLE).delete().eq('id', id)
  return error ? { error: error.message } : { ok: true }
}
