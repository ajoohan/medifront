import { useRef, useState } from 'react'
import { pptxToDeck } from '../../lib/pptxToDeck'
import { INTERNAL_DOC_CATEGORIES } from '../../lib/internalDocsSeed'

// 자료 등록 — PPT 를 올려 메디프론트 서식 자료로 바꾼다.
// 변환 결과를 먼저 보여 주고, 제목·요약을 확인한 뒤 저장한다.
export default function PptxUpload({ onSave, onCancel, busy }) {
  const fileRef = useRef(null)
  const [parsing, setParsing] = useState(false)
  const [result, setResult] = useState(null) // { html, slideCount, dropped, bytes }
  const [fileName, setFileName] = useState('')
  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [category, setCategory] = useState(INTERNAL_DOC_CATEGORIES[0])
  const [error, setError] = useState('')

  const pick = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError('')
    setParsing(true)
    setResult(null)
    const res = await pptxToDeck(file)
    setParsing(false)
    if (res.error) {
      setError(res.error)
      return
    }
    setResult(res)
    setFileName(file.name)
    setTitle(res.title || file.name.replace(/\.pptx?$/i, ''))
  }

  const save = () => {
    const t = title.trim()
    if (!t) {
      window.alert('자료 제목을 입력해 주세요.')
      return
    }
    onSave({ title: t, summary: summary.trim(), category, content: result.html })
  }

  return (
    <div className="mag-editor">
      <div className="mag-editor__top">
        <button className="mag-editor__back" onClick={onCancel}>
          ← 목록으로
        </button>
        {result && (
          <button className="btn btn--primary admin-head__action" onClick={save} disabled={busy}>
            {busy ? '저장 중...' : '자료실에 등록'}
          </button>
        )}
      </div>

      <h3 className="consult-editor__section">PPT 등록</h3>

      {/* 무엇이 되고 무엇이 안 되는지 먼저 알린다 — 원본 그대로를 기대하면 실망한다 */}
      <div className="admin-notice">
        PPT의 <b>글과 그림을 가져와 메디프론트 서식으로 다시 조판</b>합니다. 글꼴·색·여백이 사이트와
        같아집니다.
        <br />
        도형 배치·표·차트·애니메이션은 파워포인트 고유의 표현이라 그대로 옮겨지지 않습니다. 원본
        모습이 그대로 필요하면 PDF로 저장해 공유하세요.
      </div>

      {!result && (
        <div className="pptx-drop">
          <input
            ref={fileRef}
            type="file"
            accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
            hidden
            onChange={pick}
          />
          <button
            type="button"
            className="btn btn--primary btn--lg"
            onClick={() => fileRef.current?.click()}
            disabled={parsing}
          >
            {parsing ? 'PPT 읽는 중...' : 'PPT 파일 선택'}
          </button>
          <p className="pptx-drop__hint">
            .pptx 파일만 됩니다. 구형 .ppt 는 파워포인트에서 .pptx 로 저장한 뒤 올려 주세요.
          </p>
          {error && <p className="pptx-drop__error">{error}</p>}
        </div>
      )}

      {result && (
        <>
          <div className="pptx-summary">
            <b>{fileName}</b>
            <span>
              슬라이드 {result.slideCount}장 · {Math.round(result.bytes / 1024)}KB
              {result.dropped > 0 && ` · 용량 때문에 그림 ${result.dropped}장 제외`}
            </span>
            <button type="button" className="pptx-summary__again" onClick={() => setResult(null)}>
              다른 파일 선택
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
              placeholder="자료 제목"
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

          <h3 className="consult-editor__section">미리보기</h3>
          <div
            className="doc-read__body pptx-preview"
            dangerouslySetInnerHTML={{ __html: result.html }}
          />
        </>
      )}
    </div>
  )
}
