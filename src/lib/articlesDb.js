// 매거진 게시물 DB (Supabase public.articles 테이블)
// 테이블 생성 SQL: supabase/setup-2.sql
import { supabase, isSupabaseConfigured } from './supabase'

const TABLE = 'articles'

function fromRow(r) {
  return {
    id: r.id,
    title: r.title,
    content: r.content || '',
    thumbnail: r.thumbnail,
    excerpt: r.excerpt || '',
    read: r.read || '1분',
    status: r.status || 'visible',
    date: r.date,
    category: r.category || null,
  }
}

function toRow(a) {
  return {
    title: a.title,
    content: a.content,
    thumbnail: a.thumbnail,
    excerpt: a.excerpt,
    read: a.read,
    status: a.status,
    date: a.date,
  }
}

// 전체 목록 (최신순) — 테이블 미생성 시 null (호출부에서 localStorage 폴백)
export async function fetchArticlesDb() {
  if (!isSupabaseConfigured) return null
  const { data, error } = await supabase.from(TABLE).select('*').order('id', { ascending: false })
  if (error) return null
  return data.map(fromRow)
}

export async function insertArticleDb(a) {
  const { data, error } = await supabase.from(TABLE).insert(toRow(a)).select().single()
  return error ? { error: error.message } : { ok: true, article: fromRow(data) }
}

export async function updateArticleDb(id, patch) {
  const row = {}
  for (const k of ['title', 'content', 'thumbnail', 'excerpt', 'read', 'status']) {
    if (patch[k] !== undefined) row[k] = patch[k]
  }
  const { error } = await supabase.from(TABLE).update(row).eq('id', id)
  return error ? { error: error.message } : { ok: true }
}

export async function deleteArticleDb(id) {
  const { error } = await supabase.from(TABLE).delete().eq('id', id)
  return error ? { error: error.message } : { ok: true }
}
