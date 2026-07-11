import { useCallback, useEffect, useState } from 'react'
import { useUser } from '../context/UserContext'
import { fetchMyInquiries, createInquiry } from '../lib/inquiriesDb'

function formatDateTime(iso) {
  const d = new Date(iso)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

// 1:1 상담 — 비공개 문의 게시판 (본인 글만 표시, 관리자 답변 확인)
export default function InquiryModal({ open, onClose }) {
  const { user } = useUser()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [list, setList] = useState([])
  const [available, setAvailable] = useState(true) // inquiries 테이블 사용 가능 여부
  const [busy, setBusy] = useState(false)
  const [info, setInfo] = useState('')

  const load = useCallback(async () => {
    if (!user) return
    const rows = await fetchMyInquiries(user.email)
    if (rows === null) {
      setAvailable(false)
    } else {
      setAvailable(true)
      setList(rows)
    }
  }, [user])

  useEffect(() => {
    if (open) {
      setTitle('')
      setContent('')
      setInfo('')
      load()
    }
  }, [open, load])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open || !user) return null

  const submit = async (e) => {
    e.preventDefault()
    setInfo('')
    setBusy(true)
    const r = await createInquiry({
      email: user.email,
      name: user.name,
      title: title.trim(),
      content: content.trim(),
    })
    setBusy(false)
    if (r.ok) {
      setTitle('')
      setContent('')
      setInfo('문의가 접수되었습니다. 답변이 등록되면 이 창에서 확인할 수 있습니다.')
      load()
    } else {
      setInfo(`접수에 실패했습니다: ${r.error}`)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="inquiry-modal" onClick={(e) => e.stopPropagation()}>
        <button className="login-modal__close" onClick={onClose} aria-label="닫기">
          ✕
        </button>

        <h3 className="inquiry-modal__title">1:1 상담</h3>
        <p className="inquiry-modal__sub">
          {user.name} 님의 비공개 상담 게시판입니다. 문의 내용은 본인과 담당자만 볼 수 있습니다.
        </p>

        {info && <div className="auth-info">{info}</div>}

        {!available ? (
          <div className="auth-notice">
            1:1 상담 게시판을 준비 중입니다. 잠시 후 다시 이용해 주세요.
          </div>
        ) : (
          <>
            <form onSubmit={submit} className="inquiry-form">
              <div className="field">
                <label>제목</label>
                <input
                  type="text"
                  placeholder="문의 제목을 입력하세요"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label>문의 내용</label>
                <textarea
                  placeholder="개원 준비 상황, 궁금한 점을 자유롭게 남겨주세요. 담당 컨설턴트가 답변드립니다."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={5}
                  required
                />
              </div>
              <button
                type="submit"
                className="btn btn--primary btn--lg"
                style={{ width: '100%' }}
                disabled={busy}
              >
                {busy ? '접수 중...' : '문의 접수'}
              </button>
            </form>

            <h4 className="inquiry-modal__list-title">내 문의 내역</h4>
            {list.length === 0 ? (
              <p className="inquiry-modal__empty">접수한 문의가 없습니다.</p>
            ) : (
              <ul className="inquiry-list">
                {list.map((q) => (
                  <li key={q.id} className="inquiry-item">
                    <div className="inquiry-item__head">
                      <span className="inquiry-item__date">{formatDateTime(q.createdAt)}</span>
                      <span
                        className={`iq-badge ${q.status === 'answered' ? 'iq-badge--answered' : 'iq-badge--open'}`}
                      >
                        {q.status === 'answered' ? '답변완료' : '답변대기'}
                      </span>
                    </div>
                    <b className="inquiry-item__title">{q.title}</b>
                    <p className="inquiry-item__content">{q.content}</p>
                    {q.answer && (
                      <div className="inquiry-item__answer">
                        <b>답변</b>
                        <p>{q.answer}</p>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  )
}
