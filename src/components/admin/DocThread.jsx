import { useEffect, useRef, useState } from 'react'
import { useUser } from '../../context/UserContext'
import { fetchComments, insertComment, deleteComment, docKeyOf } from '../../lib/internalCommentsDb'

// 몇 분 전 / 몇 시간 전처럼 읽히게. 하루가 넘으면 날짜로 보여 준다.
function timeAgo(iso) {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return ''
  const m = Math.floor((Date.now() - t) / 60000)
  if (m < 1) return '방금'
  if (m < 60) return `${m}분 전`
  if (m < 60 * 24) return `${Math.floor(m / 60)}시간 전`
  const d = new Date(t)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

// 이름 첫 글자로 만드는 동그란 표식 — 누가 썼는지 목록에서 빨리 구분된다
const initialOf = (name) => (name || '?').trim().charAt(0)

// 자료 아래에 붙는 의견 스레드. 운영자끼리 자료를 두고 나누는 대화를 남긴다.
export default function DocThread({ doc }) {
  const { user } = useUser()
  const docKey = docKeyOf(doc)

  const [items, setItems] = useState(null) // null = 불러오는 중
  const [available, setAvailable] = useState(true)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const boxRef = useRef(null)

  useEffect(() => {
    let alive = true
    setItems(null)
    fetchComments(docKey).then((list) => {
      if (!alive) return
      if (list === null) setAvailable(false)
      else {
        setAvailable(true)
        setItems(list)
      }
    })
    return () => {
      alive = false
    }
  }, [docKey])

  const submit = async (e) => {
    e.preventDefault()
    const content = text.trim()
    if (!content || busy) return
    setBusy(true)
    const res = await insertComment({ docKey, author: user?.name || '운영자', content })
    setBusy(false)
    if (res.error) {
      window.alert(`의견 등록 실패: ${res.error}`)
      return
    }
    setItems((ls) => [...(ls || []), res.comment])
    setText('')
    boxRef.current?.focus()
  }

  const remove = async (c) => {
    if (!window.confirm('이 의견을 삭제하시겠습니까?')) return
    setItems((ls) => ls.filter((it) => it.id !== c.id))
    const res = await deleteComment(c.id)
    if (res.error) {
      window.alert(`삭제 실패: ${res.error}`)
      // 서버가 거절했으면 화면도 되돌린다
      const list = await fetchComments(docKey)
      if (list) setItems(list)
    }
  }

  // Ctrl/⌘+Enter 로 바로 등록 — 줄바꿈이 잦은 메모라 Enter 는 줄바꿈으로 둔다
  const onKeyDown = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submit(e)
  }

  return (
    <section className="thread">
      <h3 className="thread__title">
        운영자 의견
        {items?.length ? <span className="thread__count">{items.length}</span> : null}
      </h3>

      {!available ? (
        <div className="admin-notice admin-notice--warn">
          의견 저장소(internal_comments)에 연결되지 않았습니다. 서버 배포가 끝나면 사용할 수
          있습니다.
        </div>
      ) : (
        <>
          {items === null ? (
            <p className="thread__empty">불러오는 중…</p>
          ) : items.length === 0 ? (
            <p className="thread__empty">
              아직 남긴 의견이 없습니다. 이 자료에 대해 자유롭게 적어 주세요.
            </p>
          ) : (
            <ul className="thread__list">
              {items.map((c) => (
                <li key={c.id} className="thread__item">
                  <span className="thread__avatar" aria-hidden="true">
                    {initialOf(c.author)}
                  </span>
                  <div className="thread__body">
                    <div className="thread__meta">
                      <b>{c.author}</b>
                      <time>{timeAgo(c.createdAt)}</time>
                      {/* 남의 글은 지울 수 없다 — 서버에서도 막는다 */}
                      {user?.email && c.authorEmail === user.email && (
                        <button
                          type="button"
                          className="thread__del"
                          onClick={() => remove(c)}
                          aria-label="내 의견 삭제"
                        >
                          삭제
                        </button>
                      )}
                    </div>
                    <p>{c.content}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <form className="thread__form" onSubmit={submit}>
            <textarea
              ref={boxRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="이 자료에 대한 의견을 남겨 주세요."
              rows={3}
            />
            <div className="thread__actions">
              <span className="thread__hint">Ctrl + Enter 로 등록</span>
              <button type="submit" className="btn btn--primary" disabled={busy || !text.trim()}>
                {busy ? '등록 중...' : '의견 남기기'}
              </button>
            </div>
          </form>
        </>
      )}
    </section>
  )
}
