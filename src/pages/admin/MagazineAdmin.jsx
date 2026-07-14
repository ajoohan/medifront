import { useEffect, useRef, useState } from 'react'
import { loadArticles, saveArticles } from '../../lib/magazineStore'
import { fileToDataUrl } from '../../lib/imageUtils'
import {
  fetchArticlesDb,
  insertArticleDb,
  updateArticleDb,
  deleteArticleDb,
} from '../../lib/articlesDb'

const todayStr = () => {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

const FALLBACK_THUMB = 'linear-gradient(135deg, #0b3f3a, #1eb5a6)'

// 콘텐츠 HTML에서 썸네일(첫 이미지)·요약·읽기시간 자동 추출
function parseContent(html) {
  const div = document.createElement('div')
  div.innerHTML = html
  const img = div.querySelector('img')
  const text = div.textContent.replace(/\s+/g, ' ').trim()
  return {
    thumbnail: img?.getAttribute('src') || null,
    excerpt: text.slice(0, 90),
    read: `${Math.max(1, Math.round(text.length / 500))}분`,
  }
}

function extractYoutubeId(url) {
  const m = url.match(
    /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/,
  )
  return m ? m[1] : null
}

// ─────────────────────────────────────────────────────────
// 브런치 스타일 글쓰기 에디터 (contentEditable 기반)
// ─────────────────────────────────────────────────────────
function MagazineEditor({ article, onSave, onCancel }) {
  const [title, setTitle] = useState(article?.title || '')
  const bodyRef = useRef(null)
  const fileRef = useRef(null)
  const initialHtml = article?.content || (article?.excerpt ? `<p>${article.excerpt}</p>` : '')

  const exec = (cmd, val) => {
    bodyRef.current?.focus()
    document.execCommand(cmd, false, val)
  }

  // 여러 장 동시 등록: 전부 압축(1장당 5MB 미만 보장) 후 한 번에 삽입
  const addImages = async (e) => {
    const files = [...e.target.files]
    e.target.value = ''
    if (!files.length) return
    try {
      const urls = await Promise.all(files.map((f) => fileToDataUrl(f)))
      bodyRef.current?.focus()
      const html = urls.map((u) => `<img src="${u}" alt="" /><p><br/></p>`).join('')
      document.execCommand('insertHTML', false, html)
    } catch {
      window.alert('이미지를 불러오지 못했습니다.')
    }
  }

  const addYoutube = () => {
    const url = window.prompt('유튜브 영상 주소(URL)를 입력하세요')
    if (!url) return
    const id = extractYoutubeId(url.trim())
    if (!id) {
      window.alert('유튜브 주소를 인식하지 못했습니다. (예: https://youtu.be/영상ID)')
      return
    }
    bodyRef.current?.focus()
    document.execCommand(
      'insertHTML',
      false,
      `<div class="mag-video" contenteditable="false"><iframe src="https://www.youtube.com/embed/${id}" title="YouTube video" allowfullscreen></iframe></div><p><br/></p>`,
    )
  }

  const save = () => {
    const t = title.trim()
    if (!t) {
      window.alert('제목을 입력해 주세요.')
      return
    }
    onSave({ title: t, content: bodyRef.current?.innerHTML || '' })
  }

  // 툴바 버튼은 onMouseDown preventDefault로 에디터 선택 영역을 유지
  const keep = (e) => e.preventDefault()

  return (
    <div className="mag-editor">
      <div className="mag-editor__top">
        <button className="mag-editor__back" onClick={onCancel}>
          ← 목록으로
        </button>
        <button className="btn btn--primary admin-head__action" onClick={save}>
          저장
        </button>
      </div>

      <input
        className="mag-editor__title"
        placeholder="제목을 입력하세요"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />

      <div className="mag-editor__toolbar">
        <button onMouseDown={keep} onClick={() => exec('fontSize', 6)}>
          제목
        </button>
        <button onMouseDown={keep} onClick={() => exec('fontSize', 5)}>
          부제목
        </button>
        <button onMouseDown={keep} onClick={() => exec('fontSize', 3)}>
          본문
        </button>
        <span className="mag-editor__divider" />
        <button className="tb-bold" onMouseDown={keep} onClick={() => exec('bold')}>
          B
        </button>
        <span className="mag-editor__divider" />
        <button onMouseDown={keep} onClick={() => fileRef.current?.click()}>
          🖼 이미지
        </button>
        <button onMouseDown={keep} onClick={addYoutube}>
          ▶ 유튜브
        </button>
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={addImages} />
      </div>

      <div
        className="mag-editor__body"
        ref={bodyRef}
        contentEditable
        suppressContentEditableWarning
        data-placeholder="내용을 입력하세요. 첫 번째로 첨부한 이미지가 썸네일이 됩니다."
        dangerouslySetInnerHTML={{ __html: initialHtml }}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// 매거진 관리 — 썸네일 그리드 (PC 5열)
// ─────────────────────────────────────────────────────────
export default function MagazineAdmin() {
  const [articles, setArticles] = useState([])
  const [dbReady, setDbReady] = useState(false) // articles 테이블 사용 가능 여부
  const [checked, setChecked] = useState(false) // DB 확인 완료 여부
  // writing: null | { mode: 'new' } | { mode: 'edit', article }
  const [writing, setWriting] = useState(null)

  // DB에서 게시물 로드 — 테이블 미생성 시 브라우저 저장 폴백
  useEffect(() => {
    fetchArticlesDb().then((list) => {
      if (list) {
        setArticles(list)
        setDbReady(true)
      } else {
        setArticles(loadArticles())
      }
      setChecked(true)
    })
  }, [])

  const update = (list) => {
    setArticles(list)
    if (!dbReady && !saveArticles(list)) {
      window.alert(
        '브라우저 저장 공간이 부족해 저장하지 못했습니다.\n이미지 수를 줄이거나 기존 글을 정리해 주세요.',
      )
    }
  }

  const handleSave = async ({ title, content }) => {
    const meta = parseContent(content)
    if (writing.mode === 'new') {
      const article = { status: 'visible', date: todayStr(), title, content, ...meta }
      if (dbReady) {
        const res = await insertArticleDb(article)
        if (res.ok) {
          update([res.article, ...articles])
        } else {
          window.alert(`게시물 저장 실패: ${res.error}`)
          return
        }
      } else {
        update([{ id: Date.now(), ...article }, ...articles])
      }
    } else {
      const patch = { title, content, ...meta }
      update(articles.map((a) => (a.id === writing.article.id ? { ...a, ...patch } : a)))
      if (dbReady) updateArticleDb(writing.article.id, patch)
    }
    setWriting(null)
  }

  const toggleStatus = (id) => {
    const target = articles.find((a) => a.id === id)
    const next = target?.status === 'hidden' ? 'visible' : 'hidden'
    update(articles.map((a) => (a.id === id ? { ...a, status: next } : a)))
    if (dbReady) updateArticleDb(id, { status: next })
  }

  const removeArticle = (id) => {
    const target = articles.find((a) => a.id === id)
    if (window.confirm(`'${target?.title}' 글을 삭제하시겠습니까?`)) {
      update(articles.filter((a) => a.id !== id))
      if (dbReady) deleteArticleDb(id)
    }
  }

  if (writing) {
    return (
      <MagazineEditor
        article={writing.mode === 'edit' ? writing.article : null}
        onSave={handleSave}
        onCancel={() => setWriting(null)}
      />
    )
  }

  return (
    <>
      <div className="admin-head">
        <div>
          <h1>매거진 관리</h1>
          <p>매거진 글을 작성하고 노출 여부를 관리합니다.</p>
        </div>
        <button
          className="btn btn--primary admin-head__action"
          onClick={() => setWriting({ mode: 'new' })}
        >
          + 매거진 작성
        </button>
      </div>

      {checked && !dbReady && (
        <div className="admin-notice admin-notice--warn">
          게시물 DB(articles)에 연결되지 않아 이 브라우저에만 저장됩니다. AWS 백엔드 배포와 환경변수
          설정(docs/aws-backend.md)이 완료되면 모든 방문자에게 게시물이 표시됩니다.
        </div>
      )}

      {articles.length === 0 ? (
        <div className="mag-admin-empty">등록된 매거진이 없습니다</div>
      ) : (
        <div className="mag-admin-grid">
          {articles.map((a) => (
            <article className="mag-admin-card" key={a.id}>
              <div
                className="mag-admin-card__thumb"
                style={
                  a.thumbnail
                    ? { backgroundImage: `url(${a.thumbnail})` }
                    : { background: FALLBACK_THUMB }
                }
              >
                {a.status === 'hidden' && <span className="mag-admin-card__hidden">숨김</span>}
              </div>
              <div className="mag-admin-card__body">
                <h3>{a.title}</h3>
                <div className="admin-actions">
                  <button onClick={() => setWriting({ mode: 'edit', article: a })}>수정</button>
                  <button onClick={() => toggleStatus(a.id)}>
                    {a.status === 'hidden' ? '노출' : '숨김'}
                  </button>
                  <button className="danger" onClick={() => removeArticle(a.id)}>
                    삭제
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  )
}
