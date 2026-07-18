// 매거진 게시물 DB (AWS DynamoDB articles — Lambda API 경유)
import { apiGet, apiSend, isApiConfigured } from './api'

const PATH = '/articles'

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
    category: a.category,
  }
}

// 전체 목록 (최신순) — API 미설정/오류 시 null (호출부에서 localStorage 폴백)
export async function fetchArticlesDb() {
  if (!isApiConfigured) return null
  const data = await apiGet(PATH)
  if (!data) return null
  return data.sort((a, b) => b.id - a.id).map(fromRow)
}

export async function insertArticleDb(a) {
  const r = await apiSend('POST', PATH, toRow(a))
  return r.error ? { error: r.error } : { ok: true, article: fromRow(r.data) }
}

export async function updateArticleDb(id, patch) {
  const row = {}
  for (const k of ['title', 'content', 'thumbnail', 'excerpt', 'read', 'status', 'category']) {
    if (patch[k] !== undefined) row[k] = patch[k]
  }
  const r = await apiSend('PATCH', `${PATH}/${id}`, row)
  return r.error ? { error: r.error } : { ok: true }
}

export async function deleteArticleDb(id) {
  const r = await apiSend('DELETE', `${PATH}/${id}`)
  return r.error ? { error: r.error } : { ok: true }
}
