import { useEffect, useMemo, useRef, useState } from 'react'
import { fileToDataUrl } from '../../lib/imageUtils'
import {
  fetchInternalDocs,
  insertInternalDoc,
  updateInternalDoc,
  deleteInternalDoc,
} from '../../lib/internalDocsDb'
import { INTERNAL_DOCS_SEED, INTERNAL_DOC_CATEGORIES } from '../../lib/internalDocsSeed'
import { INTERNAL_FILES } from '../../lib/internalFiles'
import useAdminData from '../../hooks/useAdminData'
import useBackClose from '../../hooks/useBackClose'
import { CK } from '../../lib/adminCache'
import { SkeletonCards, LoadingRegion } from '../../components/admin/Skeleton'
import DocThread from '../../components/admin/DocThread'
import PptxUpload from '../../components/admin/PptxUpload'

function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}`
}

// ─────────────────────────────────────────────────────────
// 자료 작성/수정 — 매거진 에디터와 같은 방식(본문은 contentEditable)
// ─────────────────────────────────────────────────────────
function DocEditor({ doc, onSave, onCancel, busy }) {
  const [title, setTitle] = useState(doc?.title || '')
  const [summary, setSummary] = useState(doc?.summary || '')
  const [category, setCategory] = useState(doc?.category || INTERNAL_DOC_CATEGORIES[0])
  const bodyRef = useRef(null)
  const fileRef = useRef(null)

  const exec = (cmd, val) => {
    bodyRef.current?.focus()
    document.execCommand(cmd, false, val)
  }
  const keep = (e) => e.preventDefault()

  const addImages = async (e) => {
    const files = [...e.target.files]
    e.target.value = ''
    if (!files.length) return
    try {
      const urls = await Promise.all(files.map((f) => fileToDataUrl(f)))
      bodyRef.current?.focus()
      document.execCommand(
        'insertHTML',
        false,
        urls.map((u) => `<img src="${u}" alt="" /><p><br/></p>`).join(''),
      )
    } catch {
      window.alert('이미지를 불러오지 못했습니다.')
    }
  }

  const save = () => {
    const t = title.trim()
    if (!t) {
      window.alert('제목을 입력해 주세요.')
      return
    }
    onSave({
      title: t,
      summary: summary.trim(),
      category,
      content: bodyRef.current?.innerHTML || '',
    })
  }

  return (
    <div className="mag-editor">
      <div className="mag-editor__top">
        <button className="mag-editor__back" onClick={onCancel}>
          ← 목록으로
        </button>
        <button className="btn btn--primary admin-head__action" onClick={save} disabled={busy}>
          {busy ? '저장 중...' : '저장'}
        </button>
      </div>

      <div className="mag-editor__head">
        <select
          className="mag-editor__cat"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          aria-label="분류"
        >
          {INTERNAL_DOC_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <input
          className="mag-editor__title"
          placeholder="자료 제목을 입력하세요"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      <input
        className="doc-editor__summary"
        placeholder="한 줄 요약 — 목록에서 제목 아래에 표시됩니다"
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
      />

      <div className="mag-editor__toolbar">
        <button onMouseDown={keep} onClick={() => exec('formatBlock', 'h3')}>
          제목
        </button>
        <button onMouseDown={keep} onClick={() => exec('formatBlock', 'p')}>
          본문
        </button>
        <span className="mag-editor__divider" />
        <button className="tb-bold" onMouseDown={keep} onClick={() => exec('bold')}>
          B
        </button>
        <button onMouseDown={keep} onClick={() => exec('insertUnorderedList')}>
          • 목록
        </button>
        <button onMouseDown={keep} onClick={() => exec('insertOrderedList')}>
          1. 순서
        </button>
        <span className="mag-editor__divider" />
        <button onMouseDown={keep} onClick={() => fileRef.current?.click()}>
          🖼 이미지
        </button>
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={addImages} />
      </div>

      <div
        className="mag-editor__body"
        ref={bodyRef}
        contentEditable
        suppressContentEditableWarning
        data-placeholder="내용을 입력하세요."
        dangerouslySetInnerHTML={{ __html: doc?.content || '' }}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// 내부 자료실 — 관리자·운영자만 보는 사내 문서함
// (일반 회원은 서버에서 조회 자체가 막혀 있다)
// ─────────────────────────────────────────────────────────
export default function InternalDocsAdmin() {
  const { data, status, fresh, setData } = useAdminData(CK.internalDocs, fetchInternalDocs)
  // useMemo 로 감싸 참조가 매 렌더 바뀌지 않게 한다 (아래 동기화 useEffect 의 의존성)
  const docs = useMemo(() => data || [], [data])
  const available = data !== null
  const checked = status === 'ready'

  const [viewing, setViewing] = useState(null) // 열람 중인 자료
  const [writing, setWriting] = useState(null) // null | { mode:'new' } | { mode:'edit', doc }

  // 브라우저 뒤로가기로 목록에 돌아온다 (사이트 밖으로 나가지 않게)
  useBackClose(!!viewing || !!writing, () => {
    setWriting(null)
    setViewing(null)
  })
  const [busy, setBusy] = useState(false)
  const [filter, setFilter] = useState('전체')
  const [copied, setCopied] = useState('') // 방금 링크를 복사한 자료 id

  // 파일 주소를 전체 주소(https://…)로 만들어 클립보드에 넣는다 — 그대로 공유할 수 있게
  const copyLink = async (doc) => {
    const url = `${window.location.origin}${doc.file}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(doc.id)
      setTimeout(() => setCopied(''), 1800)
    } catch {
      window.prompt('아래 주소를 복사하세요', url)
    }
  }

  // 목록이 갱신되면 열람 중인 자료도 최신 내용으로 맞춘다
  useEffect(() => {
    if (!viewing) return
    const latest = docs.find((d) => d.id === viewing.id)
    if (latest && latest !== viewing) setViewing(latest)
  }, [docs, viewing])

  const setDocs = (next) => setData((cur) => (typeof next === 'function' ? next(cur || []) : next))

  const handleSave = async (fields) => {
    setBusy(true)
    // 직접 쓴 자료('new')와 PPT 로 만든 자료('upload') 모두 새 자료다
    if (writing.mode !== 'edit') {
      const res = await insertInternalDoc(fields)
      setBusy(false)
      if (!res.ok) {
        window.alert(`자료 저장 실패: ${res.error}`)
        return
      }
      setDocs((ls) => [res.doc, ...ls])
    } else {
      const id = writing.doc.id
      const res = await updateInternalDoc(id, fields)
      setBusy(false)
      if (!res.ok) {
        window.alert(`자료 수정 실패: ${res.error}`)
        return
      }
      const updatedAt = new Date().toISOString()
      setDocs((ls) => ls.map((d) => (d.id === id ? { ...d, ...fields, updatedAt } : d)))
      setViewing((v) => (v && v.id === id ? { ...v, ...fields, updatedAt } : v))
    }
    setWriting(null)
  }

  const remove = async (doc) => {
    if (!window.confirm(`'${doc.title}' 자료를 삭제하시겠습니까?`)) return
    setDocs((ls) => ls.filter((d) => d.id !== doc.id))
    setViewing(null)
    const res = await deleteInternalDoc(doc.id)
    if (!res.ok) window.alert(`삭제 실패: ${res.error}`)
  }

  // 자료실이 비었을 때 기본 문서를 한 번에 넣는다
  const seed = async () => {
    if (!window.confirm(`운영 기본 자료 ${INTERNAL_DOCS_SEED.length}건을 등록하시겠습니까?`)) return
    setBusy(true)
    const added = []
    for (const d of INTERNAL_DOCS_SEED) {
      const res = await insertInternalDoc(d)
      if (res.ok) added.push(res.doc)
    }
    setBusy(false)
    if (added.length === 0) {
      window.alert('기본 자료를 등록하지 못했습니다. 잠시 후 다시 시도해 주세요.')
      return
    }
    setDocs((ls) => [...added.reverse(), ...ls])
  }

  // ── PPT 등록 화면 ──
  if (writing?.mode === 'upload') {
    return <PptxUpload onSave={handleSave} onCancel={() => setWriting(null)} busy={busy} />
  }

  // ── 자료 작성/수정 화면 ──
  if (writing) {
    return (
      <DocEditor
        doc={writing.mode === 'edit' ? writing.doc : null}
        onSave={handleSave}
        onCancel={() => setWriting(null)}
        busy={busy}
      />
    )
  }

  // ── 파일형 자료 열람 — 문서 자체가 반응형이라 폭만 채워 주면 PC·모바일 모두 맞는다 ──
  if (viewing?.file) {
    return (
      <>
        <div className="mag-editor__top">
          <button className="mag-editor__back" onClick={() => setViewing(null)}>
            ← 목록으로
          </button>
          <div className="admin-actions">
            <button onClick={() => copyLink(viewing)}>
              {copied === viewing.id ? '복사됨' : '링크 복사'}
            </button>
            <a className="admin-linkbtn" href={viewing.file} target="_blank" rel="noreferrer">
              새 창으로 보기 ↗
            </a>
            <a className="admin-linkbtn" href={viewing.file} download>
              다운로드
            </a>
          </div>
        </div>

        <div className="doc-frame doc-frame--admin admin-fade">
          <div className="doc-frame__head">
            <span className="doc-read__cat">{viewing.category}</span>
            <b>{viewing.title}</b>
          </div>
          <iframe className="doc-frame__view" src={viewing.file} title={viewing.title} />
        </div>

        <DocThread doc={viewing} />
      </>
    )
  }

  // ── 자료 열람 화면 ──
  if (viewing) {
    return (
      <>
        <div className="mag-editor__top">
          <button className="mag-editor__back" onClick={() => setViewing(null)}>
            ← 목록으로
          </button>
          <div className="admin-actions">
            <button onClick={() => setWriting({ mode: 'edit', doc: viewing })}>수정</button>
            <button className="danger" onClick={() => remove(viewing)}>
              삭제
            </button>
          </div>
        </div>

        <article className="doc-read doc-read--admin admin-fade">
          <span className="doc-read__cat">{viewing.category}</span>
          <h1>{viewing.title}</h1>
          {viewing.summary && <p className="doc-read__summary">{viewing.summary}</p>}
          <div className="doc-read__meta">최종 수정 {formatDate(viewing.updatedAt)}</div>
          <div
            className="doc-read__body"
            dangerouslySetInnerHTML={{ __html: viewing.content || '<p>내용이 없습니다.</p>' }}
          />
        </article>

        <DocThread doc={viewing} />
      </>
    )
  }

  // ── 목록 화면 ──
  // 파일형 자료(public/internal/)를 먼저, 그 뒤에 관리자가 쓴 자료를 붙인다
  const all = [...INTERNAL_FILES, ...docs]
  const shown = filter === '전체' ? all : all.filter((d) => d.category === filter)

  return (
    <>
      <div className="admin-head">
        <div>
          <h1>내부 자료실</h1>
          <p>
            관리자·운영자만 보는 사내 자료입니다. 홈페이지에는 노출되지 않으며, 회원은 열람할 수
            없습니다.
          </p>
        </div>
        <div className="admin-head__buttons">
          {/* 아직 작성한 자료가 없으면 기본 운영 자료를 한 번에 채울 수 있게 */}
          {available && docs.length === 0 && (
            <button className="btn admin-head__action" onClick={seed} disabled={busy}>
              {busy ? '등록 중...' : `기본 자료 ${INTERNAL_DOCS_SEED.length}건 불러오기`}
            </button>
          )}
          {/* 두 가지 경로 — 직접 쓰거나(작성), 이미 만든 PPT 를 올리거나(등록) */}
          {available && (
            <button className="btn admin-head__action" onClick={() => setWriting({ mode: 'new' })}>
              + 자료 작성
            </button>
          )}
          {available && (
            <button
              className="btn btn--primary admin-head__action"
              onClick={() => setWriting({ mode: 'upload' })}
            >
              + 자료 등록 (PPT)
            </button>
          )}
        </div>
      </div>

      {checked && !available && (
        <div className="admin-notice admin-notice--warn">
          내부 자료실 DB(internal_docs)에 연결되지 않았습니다. 서버 배포가 끝나면 자료를 등록할 수
          있습니다.
        </div>
      )}

      {checked && !fresh && <div className="admin-refresh" aria-label="최신 목록을 받는 중" />}

      {/* 분류 필터 — 자료가 있을 때만 */}
      {docs.length > 0 && (
        <div className="magazine__filter internal-filter" style={{ marginBottom: 18 }}>
          {['전체', ...INTERNAL_DOC_CATEGORIES].map((c) => (
            <button
              key={c}
              className={`mag-chip ${filter === c ? 'is-active' : ''}`}
              onClick={() => setFilter(c)}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {!checked ? (
        <LoadingRegion label="내부 자료 불러오는 중">
          <SkeletonCards count={3} lines={2} />
        </LoadingRegion>
      ) : all.length === 0 ? (
        <div className="mag-empty">
          <span className="mag-empty__icon" aria-hidden="true">
            <svg
              width="30"
              height="30"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h4l2 2.5h9A1.5 1.5 0 0 1 21 10v8.5A1.5 1.5 0 0 1 19.5 20h-15A1.5 1.5 0 0 1 3 18.5Z" />
            </svg>
          </span>
          <h3>아직 등록된 자료가 없습니다</h3>
          <p>
            사이트 운영에 필요한 기본 자료 {INTERNAL_DOCS_SEED.length}건을 바로 넣어 드릴 수
            있습니다.
            <br />
            등록 후에는 자유롭게 수정·삭제할 수 있습니다.
          </p>
          {available && (
            <button
              className="btn btn--primary"
              style={{ marginTop: 18 }}
              onClick={seed}
              disabled={busy}
            >
              {busy ? '등록 중...' : `기본 자료 ${INTERNAL_DOCS_SEED.length}건 불러오기`}
            </button>
          )}
        </div>
      ) : (
        <ul className="docs-list docs-list--admin admin-fade">
          {shown.map((d) => (
            <li key={d.file || d.id} className="docs-row">
              <button type="button" className="docs-item" onClick={() => setViewing(d)}>
                <div className="docs-item__body">
                  <span className="docs-item__kicker">
                    {d.category}
                    {d.file && <em className="docs-item__type">문서</em>}
                    {(d.date || d.updatedAt) && ` · ${formatDate(d.date || d.updatedAt)}`}
                  </span>
                  <h3>{d.title}</h3>
                  {d.summary && <p>{d.summary}</p>}
                </div>
                <span className="docs-item__go" aria-hidden="true">
                  <svg viewBox="0 0 120 12" width="120" height="12" fill="none">
                    <path
                      d="M2 6h108"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                    <path
                      d="M104 1.5 110.5 6 104 10.5"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              </button>

              {/* 파일형 자료 — 링크 복사 · 다운로드 */}
              {d.file && (
                <div className="docs-row__tools">
                  <button
                    type="button"
                    className={`icon-btn ${copied === d.id ? 'is-done' : ''}`}
                    onClick={() => copyLink(d)}
                    title="링크 복사"
                    aria-label={`${d.title} 링크 복사`}
                  >
                    {copied === d.id ? (
                      <svg
                        width="17"
                        height="17"
                        viewBox="0 0 24 24"
                        fill="none"
                        aria-hidden="true"
                      >
                        <path
                          d="m5 12.5 4.5 4.5L19 7.5"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    ) : (
                      <svg
                        width="17"
                        height="17"
                        viewBox="0 0 24 24"
                        fill="none"
                        aria-hidden="true"
                      >
                        <path
                          d="M10 13a4 4 0 0 0 5.7.3l3-3A4 4 0 0 0 13 4.7l-1.2 1.2"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M14 11a4 4 0 0 0-5.7-.3l-3 3A4 4 0 0 0 11 19.3l1.2-1.2"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </button>
                  <a
                    className="icon-btn"
                    href={d.file}
                    download
                    title="다운로드"
                    aria-label={`${d.title} 다운로드`}
                  >
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path
                        d="M12 4v11m0 0 4-4m-4 4-4-4"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M5 18.5h14"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />
                    </svg>
                  </a>
                </div>
              )}
            </li>
          ))}
          {shown.length === 0 && (
            <li>
              <div className="admin-empty">이 분류에 등록된 자료가 없습니다.</div>
            </li>
          )}
        </ul>
      )}
    </>
  )
}
