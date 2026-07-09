import { useMemo, useState } from 'react'
import { MAGAZINE_CATEGORIES } from '../../data'
import { loadArticles, saveArticles } from '../../lib/magazineStore'

const CATEGORIES = MAGAZINE_CATEGORIES.filter((c) => c !== '전체')

const todayStr = () => {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

const emptyForm = () => ({
  category: CATEGORIES[0],
  title: '',
  excerpt: '',
  date: todayStr(),
  read: '5분',
})

function formatDate(iso) {
  if (!iso) return '-'
  const [y, m, d] = iso.split('-')
  return `${y}.${m}.${d}`
}

export default function MagazineAdmin() {
  const [articles, setArticles] = useState(loadArticles)
  const [queryInput, setQueryInput] = useState('')
  const [q, setQ] = useState('')
  const [catFilter, setCatFilter] = useState('전체')
  // editing: null | { mode: 'new' } | { mode: 'edit', id }
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)

  // 상태 변경 시 localStorage에도 저장 (공개 매거진 페이지에 반영)
  const update = (list) => {
    setArticles(list)
    saveArticles(list)
  }

  const filtered = useMemo(() => {
    const keyword = q.trim()
    return articles.filter((a) => {
      const matchQ = !keyword || a.title.includes(keyword) || a.excerpt.includes(keyword)
      const matchC = catFilter === '전체' || a.category === catFilter
      return matchQ && matchC
    })
  }, [articles, q, catFilter])

  const visibleCount = articles.filter((a) => a.status !== 'hidden').length

  const handleSearch = (e) => {
    e.preventDefault()
    setQ(queryInput.trim())
  }

  const openNew = () => {
    setForm(emptyForm())
    setEditing({ mode: 'new' })
  }

  const openEdit = (a) => {
    setForm({
      category: a.category,
      title: a.title,
      excerpt: a.excerpt,
      date: a.date,
      read: a.read,
    })
    setEditing({ mode: 'edit', id: a.id })
  }

  const closeEditor = () => setEditing(null)

  const setField = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const submitEditor = (e) => {
    e.preventDefault()
    const data = {
      ...form,
      title: form.title.trim(),
      excerpt: form.excerpt.trim(),
      date: form.date || todayStr(),
      read: form.read.trim() || '5분',
    }
    if (editing.mode === 'new') {
      update([{ id: Date.now(), status: 'visible', ...data }, ...articles])
    } else {
      update(articles.map((a) => (a.id === editing.id ? { ...a, ...data } : a)))
    }
    closeEditor()
  }

  const toggleStatus = (id) => {
    update(
      articles.map((a) =>
        a.id === id ? { ...a, status: a.status === 'hidden' ? 'visible' : 'hidden' } : a,
      ),
    )
  }

  const removeArticle = (id) => {
    const target = articles.find((a) => a.id === id)
    if (window.confirm(`'${target?.title}' 글을 삭제하시겠습니까?`)) {
      update(articles.filter((a) => a.id !== id))
    }
  }

  return (
    <>
      <div className="admin-head">
        <div>
          <h1>매거진 관리</h1>
          <p>매거진 글을 등록·수정하고 노출 여부를 관리합니다.</p>
        </div>
        <button className="btn btn--primary admin-head__action" onClick={openNew}>
          + 새 글 작성
        </button>
      </div>

      <div className="admin-stats">
        <div className="admin-stat">
          <b>{articles.length}</b>
          <span>전체 글</span>
        </div>
        <div className="admin-stat">
          <b>{visibleCount}</b>
          <span>노출 중</span>
        </div>
        <div className="admin-stat">
          <b>{articles.length - visibleCount}</b>
          <span>숨김</span>
        </div>
      </div>

      <div className="admin-toolbar">
        <form className="admin-search-form" onSubmit={handleSearch}>
          <input
            className="admin-search"
            type="text"
            placeholder="제목 · 내용 검색"
            value={queryInput}
            onChange={(e) => {
              const v = e.target.value
              setQueryInput(v)
              if (v === '') setQ('')
            }}
          />
          <button type="submit" className="admin-search-btn">
            검색
          </button>
        </form>
        <select
          className="admin-grade-filter"
          value={catFilter}
          onChange={(e) => setCatFilter(e.target.value)}
          aria-label="카테고리 필터"
        >
          <option value="전체">전체 카테고리</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>제목</th>
              <th>카테고리</th>
              <th>작성일</th>
              <th>읽기 시간</th>
              <th>상태</th>
              <th>관리</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((a) => (
              <tr key={a.id}>
                <td className="t-title">
                  <span className="m-name">{a.title}</span>
                </td>
                <td>{a.category}</td>
                <td>{formatDate(a.date)}</td>
                <td>{a.read}</td>
                <td>
                  <span
                    className={`badge badge--${a.status === 'hidden' ? 'suspended' : 'active'}`}
                  >
                    {a.status === 'hidden' ? '숨김' : '노출'}
                  </span>
                </td>
                <td>
                  <div className="admin-actions">
                    <button onClick={() => openEdit(a)}>수정</button>
                    <button onClick={() => toggleStatus(a.id)}>
                      {a.status === 'hidden' ? '노출' : '숨김'}
                    </button>
                    <button className="danger" onClick={() => removeArticle(a.id)}>
                      삭제
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="admin-empty">조건에 맞는 글이 없습니다.</div>}
      </div>

      {editing && (
        <div className="modal-overlay" onClick={closeEditor} role="dialog" aria-modal="true">
          <div className="admin-editor" onClick={(e) => e.stopPropagation()}>
            <h2>{editing.mode === 'new' ? '새 글 작성' : '글 수정'}</h2>
            <form onSubmit={submitEditor}>
              <div className="admin-editor__row">
                <div className="field">
                  <label>카테고리</label>
                  <select value={form.category} onChange={setField('category')}>
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>작성일</label>
                  <input type="date" value={form.date} onChange={setField('date')} />
                </div>
              </div>
              <div className="field">
                <label>
                  제목 <span className="req">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="글 제목을 입력하세요"
                  value={form.title}
                  onChange={setField('title')}
                />
              </div>
              <div className="field">
                <label>요약</label>
                <textarea
                  placeholder="목록 카드에 표시될 요약을 입력하세요"
                  value={form.excerpt}
                  onChange={setField('excerpt')}
                />
              </div>
              <div className="field">
                <label>읽기 시간</label>
                <input
                  type="text"
                  placeholder="예: 6분"
                  value={form.read}
                  onChange={setField('read')}
                />
              </div>
              <div className="admin-editor__actions">
                <button type="button" className="cancel" onClick={closeEditor}>
                  취소
                </button>
                <button type="submit" className="btn btn--primary">
                  저장
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
