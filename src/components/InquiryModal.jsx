import { useCallback, useEffect, useState } from 'react'
import { useUser } from '../context/UserContext'
import { fetchMyInquiries, createInquiry } from '../lib/inquiriesDb'
import { formatPhone } from '../lib/phone'

function formatDateTime(iso) {
  const d = new Date(iso)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

// 1:1 상담 — 비공개 문의. 로그인 회원은 본인 문의 내역·답변 확인 가능,
// 비로그인 방문자는 이름·연락처를 남기고 문의만 접수(내역 확인 없음).
export default function InquiryModal({ open, onClose }) {
  const { user } = useUser()
  const [guest, setGuest] = useState({ name: '', phone: '', email: '' })
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [list, setList] = useState([])
  const [available, setAvailable] = useState(true) // inquiries 테이블 사용 가능 여부
  const [busy, setBusy] = useState(false)
  const [info, setInfo] = useState('')

  const load = useCallback(async () => {
    if (!user) return
    const rows = await fetchMyInquiries(user.email)
    if (rows === null) setAvailable(false)
    else {
      setAvailable(true)
      setList(rows)
    }
  }, [user])

  useEffect(() => {
    if (open) {
      setTitle('')
      setContent('')
      setGuest({ name: '', phone: '', email: '' })
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

  if (!open) return null

  const submit = async (e) => {
    e.preventDefault()
    setInfo('')
    setBusy(true)
    // 로그인 회원은 계정 정보 사용, 비로그인은 입력한 이름·연락처를 기록
    const payload = user
      ? { email: user.email, name: user.name, title: title.trim(), content: content.trim() }
      : {
          email: guest.email.trim() || '-',
          name: `${guest.name.trim()} (${guest.phone.trim()})`,
          title: title.trim(),
          content: content.trim(),
        }
    const r = await createInquiry(payload)
    setBusy(false)
    if (r.ok) {
      setTitle('')
      setContent('')
      if (user) {
        setInfo('문의가 접수되었습니다. 답변이 등록되면 이 창에서 확인할 수 있습니다.')
        load()
      } else {
        setGuest({ name: '', phone: '', email: '' })
        setInfo('문의가 접수되었습니다. 담당 컨설턴트가 남겨주신 연락처로 답변드리겠습니다.')
      }
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

        <h3 className="inquiry-modal__title">1:1 문의</h3>
        <p className="inquiry-modal__sub">
          {user
            ? `${user.name} 님의 비공개 상담입니다. 문의 내용은 본인과 담당자만 볼 수 있습니다.`
            : '남겨주신 연락처로 담당 컨설턴트가 답변드립니다. 로그인 없이 문의하실 수 있습니다.'}
        </p>

        {info && <div className="auth-info">{info}</div>}

        {!available ? (
          <div className="auth-notice">
            1:1 문의 게시판을 준비 중입니다. 잠시 후 다시 이용해 주세요.
          </div>
        ) : (
          <>
            <form onSubmit={submit} className="inquiry-form">
              {!user && (
                <div className="form__row">
                  <div className="field">
                    <label>
                      이름 <span className="req">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="홍길동"
                      value={guest.name}
                      onChange={(e) => setGuest((g) => ({ ...g, name: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="field">
                    <label>
                      연락처 <span className="req">*</span>
                    </label>
                    <input
                      type="tel"
                      inputMode="numeric"
                      placeholder="010-0000-0000"
                      value={guest.phone}
                      onChange={(e) =>
                        setGuest((g) => ({ ...g, phone: formatPhone(e.target.value) }))
                      }
                      required
                    />
                  </div>
                </div>
              )}
              {!user && (
                <div className="field">
                  <label>이메일 (선택)</label>
                  <input
                    type="email"
                    placeholder="you@example.com"
                    value={guest.email}
                    onChange={(e) => setGuest((g) => ({ ...g, email: e.target.value }))}
                  />
                </div>
              )}
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

            {user && (
              <>
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
          </>
        )}
      </div>
    </div>
  )
}
