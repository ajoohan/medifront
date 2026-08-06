import { useEffect, useState } from 'react'
import { applyFormatted } from '../../lib/pptxToDeck'
import { fetchAiEnabled, formatDeckWithAi, aiErrorMessage } from '../../lib/aiDeckDb'
import { INTERNAL_DOC_CATEGORIES } from '../../lib/internalDocsSeed'

// 자료 등록 — PPT 변환 결과를 확인하고 등록하는 화면.
//
// 파일 고르기는 목록 화면에서 이미 끝난다. 여기서 다시 '파일 선택' 버튼을 보여 주면
// 누를 것이 뻔한 화면을 한 단계 더 거치게 되므로, 변환된 결과부터 보여 준다.
export default function PptxUpload({ parsed, fileName, onSave, onCancel, onRepick, busy }) {
  const [result, setResult] = useState(parsed) // { html, slideCount, dropped, bytes, slides }
  const [title, setTitle] = useState(parsed?.title || fileName.replace(/\.pptx?$/i, ''))
  const [summary, setSummary] = useState('')
  const [category, setCategory] = useState(INTERNAL_DOC_CATEGORIES[0])
  const [error, setError] = useState('')
  const [aiEnabled, setAiEnabled] = useState(false)
  const [aiBusy, setAiBusy] = useState(false)
  const [aiDone, setAiDone] = useState(false)
  const [raw, setRaw] = useState(null) // AI 전 원본 — 되돌리기용

  // AI 변환을 쓸 수 있는지(서버에 키가 있는지) 확인해 버튼 노출을 정한다
  useEffect(() => {
    fetchAiEnabled().then(setAiEnabled)
  }, [])

  // PPT 에서 뽑은 글을 AI 로 다듬어 다시 조판한다
  const runAi = async () => {
    if (!result?.slides) return
    setAiBusy(true)
    setError('')
    const res = await formatDeckWithAi(result.slides)
    setAiBusy(false)
    if (res.error) {
      // 구글이 알려준 사유가 있으면 함께 보여 준다 — 다음에 뭘 해야 할지가 거기 있다
      setError(aiErrorMessage(res.error) + (res.detail ? `\n\n(${res.detail})` : ''))
      return
    }
    if (!raw) setRaw(result) // 처음 한 번만 원본을 보관
    const next = applyFormatted(result.slides, res.slides)
    setResult({ ...result, ...next })
    setAiDone(true)
  }

  const undoAi = () => {
    if (!raw) return
    setResult(raw)
    setAiDone(false)
  }

  const save = async () => {
    const t = title.trim()
    if (!t) {
      setError('자료 제목을 입력해 주세요.')
      return
    }
    setError('')
    // 실패 사유를 화면에 남긴다 — 알림창은 닫으면 사라져 원인을 알 수 없다
    const res = await onSave({ title: t, summary: summary.trim(), category, content: result.html })
    if (res?.error) setError(`저장하지 못했습니다 — ${res.error}`)
  }

  return (
    <div className="mag-editor">
      <div className="mag-editor__top">
        <button className="mag-editor__back" onClick={onCancel}>
          ← 목록으로
        </button>
        <button className="btn btn--primary admin-head__action" onClick={save} disabled={busy}>
          {busy ? '저장 중...' : '자료실에 등록'}
        </button>
      </div>

      <h3 className="consult-editor__section">PPT 등록</h3>

      {result && (
        <>
          <div className="pptx-summary">
            <b>{fileName}</b>
            <span>
              슬라이드 {result.slideCount}장 · {Math.round(result.bytes / 1024)}KB
              {result.dropped > 0 && ` · 용량 때문에 그림 ${result.dropped}장 제외`}
            </span>
            <button type="button" className="pptx-summary__again" onClick={onRepick}>
              다른 파일 선택
            </button>
          </div>

          {error && <div className="admin-notice admin-notice--warn">{error}</div>}

          {/* AI 다듬기 — 서버에 키가 있을 때만 보인다.
              누르지 않으면 규칙 기반 변환 결과가 그대로 저장된다. */}
          <div className="pptx-ai">
            <div className="pptx-ai__text">
              <b>AI로 다듬기</b>
              <span>
                {aiEnabled
                  ? '장표마다 제목을 다시 뽑고 문장을 정리합니다. 없는 내용을 만들지 않습니다.'
                  : 'Gemini API 키가 서버에 등록되면 사용할 수 있습니다.'}
              </span>
            </div>
            <div className="pptx-ai__actions">
              {aiDone && raw && (
                <button type="button" className="pptx-summary__again" onClick={undoAi}>
                  원래대로
                </button>
              )}
              <button
                type="button"
                className="btn btn--primary"
                onClick={runAi}
                disabled={!aiEnabled || aiBusy}
              >
                {aiBusy ? 'AI가 다듬는 중...' : aiDone ? '다시 다듬기' : 'AI로 다듬기'}
              </button>
            </div>
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
