import { useEffect, useRef, useState } from 'react'
import { loadConsults, saveConsults } from '../../lib/consultStore'
import { fileToDataUrl, MAX_IMAGE_BYTES } from '../../lib/imageUtils'
import { SPECIALTIES, REGIONS } from '../../data'
import { formatPhone } from '../../lib/phone'
import { fetchAllInquiries, answerInquiry, deleteInquiry } from '../../lib/inquiriesDb'
import { fetchRequests, updateRequestStatus, deleteRequest } from '../../lib/requestsDb'
import {
  fetchConsultsDb,
  insertConsultDb,
  updateConsultDb,
  deleteConsultDb,
} from '../../lib/consultsDb'

// 개원희망시기 옵션 — 오늘이 속한 분기부터 향후 12개 분기(3년)
const QUARTERS = (() => {
  const d = new Date()
  let year = d.getFullYear()
  let q = Math.floor(d.getMonth() / 3) + 1
  const list = []
  for (let i = 0; i < 12; i++) {
    list.push(`${year}년 ${q}분기`)
    q += 1
    if (q > 4) {
      q = 1
      year += 1
    }
  }
  return list
})()

const EMPTY_DRAFT = {
  datetime: '',
  place: '',
  doctorName: '',
  doctorPhone: '',
  doctorEmail: '',
  specialty: '',
  region: '',
  period: '',
}

function formatDateTime(v) {
  if (!v) return '-'
  const [date, time] = v.split('T')
  const [y, m, d] = date.split('-')
  return `${y}.${m}.${d} ${time || ''}`.trim()
}

// 일반 파일 → dataURL (이미지와 달리 압축 불가 → 5MB 초과 시 거부)
function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result)
    r.onerror = reject
    r.readAsDataURL(file)
  })
}

// ─────────────────────────────────────────────────────────
// 대면 상담 기록 작성/수정 — 회의록 스타일
// ─────────────────────────────────────────────────────────
function ConsultEditor({ consult, onSave, onCancel }) {
  const [draft, setDraft] = useState(() =>
    consult ? { ...EMPTY_DRAFT, ...consult.fields } : EMPTY_DRAFT,
  )
  const bodyRef = useRef(null)
  const imageRef = useRef(null)
  const fileRef = useRef(null)

  const setD = (key) => (e) => setDraft((d) => ({ ...d, [key]: e.target.value }))
  const exec = (cmd, val) => {
    bodyRef.current?.focus()
    document.execCommand(cmd, false, val)
  }
  const keep = (e) => e.preventDefault()

  // 이미지 첨부 — 자동 압축(1장당 5MB 미만), 여러 장 동시 등록
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

  // 링크 삽입 — 텍스트를 선택한 상태면 그 텍스트에 링크, 아니면 주소 자체를 삽입
  const addLink = () => {
    const url = window.prompt('연결할 주소(URL)를 입력하세요', 'https://')
    if (!url || url === 'https://') return
    bodyRef.current?.focus()
    const sel = window.getSelection()
    if (sel && !sel.isCollapsed) {
      document.execCommand('createLink', false, url)
    } else {
      document.execCommand(
        'insertHTML',
        false,
        `<a href="${url}" target="_blank" rel="noreferrer">${url}</a>&nbsp;`,
      )
    }
  }

  // 파일 첨부 — 5MB 이하 파일을 다운로드 링크로 삽입
  const addFiles = async (e) => {
    const files = [...e.target.files]
    e.target.value = ''
    if (!files.length) return
    const tooBig = files.filter((f) => f.size > MAX_IMAGE_BYTES)
    if (tooBig.length) {
      window.alert(
        `5MB를 초과하는 파일은 첨부할 수 없습니다:\n${tooBig.map((f) => f.name).join('\n')}`,
      )
    }
    const ok = files.filter((f) => f.size <= MAX_IMAGE_BYTES)
    if (!ok.length) return
    try {
      const parts = await Promise.all(
        ok.map(async (f) => {
          const url = await readFileAsDataUrl(f)
          const kb = Math.max(1, Math.round(f.size / 1024))
          return `<a class="consult-file" href="${url}" download="${f.name}" contenteditable="false">📎 ${f.name} (${kb}KB)</a>`
        }),
      )
      bodyRef.current?.focus()
      document.execCommand('insertHTML', false, `${parts.join('<br/>')}<p><br/></p>`)
    } catch {
      window.alert('파일을 불러오지 못했습니다.')
    }
  }

  const save = () => {
    if (!draft.datetime) {
      window.alert('상담 일시를 입력해 주세요.')
      return
    }
    if (!draft.doctorName.trim()) {
      window.alert('원장 이름을 입력해 주세요.')
      return
    }
    onSave({ fields: { ...draft }, content: bodyRef.current?.innerHTML || '' })
  }

  return (
    <div className="consult-editor">
      <div className="mag-editor__top">
        <button className="mag-editor__back" onClick={onCancel}>
          ← 목록으로
        </button>
        <button className="btn btn--primary admin-head__action" onClick={save}>
          저장
        </button>
      </div>

      {/* 일시 · 장소 */}
      <div className="admin-add">
        <h3 className="consult-editor__section">기본 정보</h3>
        <div className="admin-add__grid">
          <label className="admin-add__field">
            <span>
              일시 <b className="req">*</b>
            </span>
            <input
              type="datetime-local"
              required
              value={draft.datetime}
              onChange={setD('datetime')}
            />
          </label>
          <label className="admin-add__field">
            <span>장소</span>
            <input
              type="text"
              placeholder="본사 회의실 / OO카페 등"
              value={draft.place}
              onChange={setD('place')}
            />
          </label>
        </div>

        <h3 className="consult-editor__section">원장 정보</h3>
        <div className="admin-add__grid">
          <label className="admin-add__field">
            <span>
              이름 <b className="req">*</b>
            </span>
            <input
              type="text"
              required
              placeholder="홍길동"
              value={draft.doctorName}
              onChange={setD('doctorName')}
            />
          </label>
          <label className="admin-add__field">
            <span>연락처</span>
            <input
              type="tel"
              inputMode="numeric"
              placeholder="010-0000-0000"
              value={draft.doctorPhone}
              onChange={(e) =>
                setDraft((d) => ({ ...d, doctorPhone: formatPhone(e.target.value) }))
              }
            />
          </label>
          <label className="admin-add__field">
            <span>이메일</span>
            <input
              type="email"
              placeholder="doctor@example.com"
              value={draft.doctorEmail}
              onChange={setD('doctorEmail')}
            />
          </label>
        </div>

        <h3 className="consult-editor__section">상담 개요</h3>
        <div className="admin-add__grid">
          <label className="admin-add__field">
            <span>전공과목</span>
            <select value={draft.specialty} onChange={setD('specialty')}>
              <option value="">선택</option>
              {SPECIALTIES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
              <option value="기타">기타</option>
            </select>
          </label>
          <label className="admin-add__field">
            <span>개원희망지역</span>
            <select value={draft.region} onChange={setD('region')}>
              <option value="">선택</option>
              {REGIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          <label className="admin-add__field">
            <span>개원희망시기</span>
            <select value={draft.period} onChange={setD('period')}>
              <option value="">선택</option>
              {QUARTERS.map((q) => (
                <option key={q} value={q}>
                  {q}
                </option>
              ))}
              <option value="미정">미정</option>
            </select>
          </label>
        </div>
      </div>

      {/* 상담 내용 — 리치 에디터 */}
      <h3 className="consult-editor__section">상담 내용</h3>
      <div className="mag-editor__toolbar">
        <button className="tb-bold" onMouseDown={keep} onClick={() => exec('bold')}>
          B
        </button>
        <span className="mag-editor__divider" />
        <button onMouseDown={keep} onClick={() => imageRef.current?.click()}>
          🖼 이미지
        </button>
        <button onMouseDown={keep} onClick={addLink}>
          🔗 링크
        </button>
        <button onMouseDown={keep} onClick={() => fileRef.current?.click()}>
          📎 파일
        </button>
        <input ref={imageRef} type="file" accept="image/*" multiple hidden onChange={addImages} />
        <input ref={fileRef} type="file" multiple hidden onChange={addFiles} />
      </div>
      <div
        className="mag-editor__body consult-editor__body"
        ref={bodyRef}
        contentEditable
        suppressContentEditableWarning
        data-placeholder="상담 내용을 입력하세요. 이미지·링크·파일을 첨부할 수 있습니다."
        dangerouslySetInnerHTML={{ __html: consult?.content || '' }}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// 상담 관리 > 대면 상담 — 회의록 목록
// ─────────────────────────────────────────────────────────
export default function ConsultMeetingAdmin() {
  const [consults, setConsults] = useState([])
  const [dbReady, setDbReady] = useState(false) // consults 테이블 사용 가능 여부
  const [checked, setChecked] = useState(false)
  // writing: null | { mode: 'new', fromRequest?, prefill? } | { mode: 'edit', consult }
  const [writing, setWriting] = useState(null)
  // 상담 신청 접수 (consult_requests)
  const [requests, setRequests] = useState([])
  const [reqAvailable, setReqAvailable] = useState(true)

  useEffect(() => {
    fetchRequests().then((rows) => {
      if (rows === null) setReqAvailable(false)
      else setRequests(rows)
    })
  }, [])

  // DB 로드 — 테이블 미생성 시 브라우저 저장 폴백.
  // DB가 비어 있고 브라우저 저장분이 있으면 1회 자동 이전한다.
  useEffect(() => {
    fetchConsultsDb().then(async (list) => {
      if (list) {
        setDbReady(true)
        const local = loadConsults()
        if (list.length === 0 && local.length > 0) {
          const uploaded = []
          let allOk = true
          for (const c of local) {
            const r = await insertConsultDb(c)
            if (r.ok) uploaded.push(r.consult)
            else allOk = false
          }
          if (allOk) saveConsults([]) // 이전 완료 → 브라우저 저장 비움
          setConsults(uploaded)
        } else {
          setConsults(list)
        }
      } else {
        setConsults(loadConsults())
      }
      setChecked(true)
    })
  }, [])

  const update = (list) => {
    setConsults(list)
    if (!dbReady && !saveConsults(list)) {
      window.alert(
        '브라우저 저장 공간이 부족해 저장하지 못했습니다.\n첨부 이미지·파일 수를 줄여 주세요.',
      )
    }
  }

  const handleSave = async ({ fields, content }) => {
    if (writing.mode === 'new') {
      if (dbReady) {
        const res = await insertConsultDb({ fields, content })
        if (res.ok) {
          update([res.consult, ...consults])
        } else {
          window.alert(`상담 기록 저장 실패: ${res.error}`)
          return
        }
      } else {
        update([{ id: Date.now(), fields, content }, ...consults])
      }
      // 상담 신청에서 작성한 기록이면 해당 신청을 처리완료로 전환
      if (writing.fromRequest) {
        const reqId = writing.fromRequest.id
        setRequests((ls) => ls.map((q) => (q.id === reqId ? { ...q, status: 'done' } : q)))
        updateRequestStatus(reqId, 'done')
      }
    } else {
      update(consults.map((c) => (c.id === writing.consult.id ? { ...c, fields, content } : c)))
      if (dbReady) updateConsultDb(writing.consult.id, { fields, content })
    }
    setWriting(null)
  }

  // 접수된 신청 → 상담 기록 작성 (신청자 정보 자동 입력)
  const writeFromRequest = (q) => {
    const clean = (v) => (v && v !== '-' ? v : '')
    setWriting({
      mode: 'new',
      fromRequest: q,
      prefill: {
        fields: {
          ...EMPTY_DRAFT,
          doctorName: q.name,
          doctorPhone: clean(q.phone),
          specialty: clean(q.specialty),
          region: clean(q.openingRegion),
          period: clean(q.openingPeriod),
        },
        content: q.message ? `<p><b>신청 시 문의 내용</b><br/>${q.message}</p><p><br/></p>` : '',
      },
    })
  }

  const toggleRequestStatus = (q) => {
    const next = q.status === 'done' ? 'new' : 'done'
    setRequests((ls) => ls.map((it) => (it.id === q.id ? { ...it, status: next } : it)))
    updateRequestStatus(q.id, next)
  }

  const removeRequest = (q) => {
    if (!window.confirm(`'${q.name}' 님의 상담 신청을 삭제하시겠습니까?`)) return
    setRequests((ls) => ls.filter((it) => it.id !== q.id))
    deleteRequest(q.id)
  }

  const removeConsult = (id) => {
    const target = consults.find((c) => c.id === id)
    if (window.confirm(`'${target?.fields.doctorName}' 원장 상담 기록을 삭제하시겠습니까?`)) {
      update(consults.filter((c) => c.id !== id))
      if (dbReady) deleteConsultDb(id)
    }
  }

  if (writing) {
    return (
      <ConsultEditor
        consult={writing.mode === 'edit' ? writing.consult : writing.prefill || null}
        onSave={handleSave}
        onCancel={() => setWriting(null)}
      />
    )
  }

  const newCount = requests.filter((q) => q.status === 'new').length

  return (
    <>
      <div className="admin-head">
        <div>
          <h1>대면 상담</h1>
          <p>접수된 상담 신청을 확인하고, 진행한 상담을 회의록으로 기록합니다.</p>
        </div>
        <button
          className="btn btn--primary admin-head__action"
          onClick={() => setWriting({ mode: 'new' })}
        >
          + 상담 기록 작성
        </button>
      </div>

      {checked && !dbReady && (
        <div className="admin-notice admin-notice--warn">
          상담 기록 DB(consults)에 연결되지 않아 이 브라우저에만 저장됩니다. AWS 백엔드 배포와
          환경변수 설정(docs/aws-backend.md)을 확인해 주세요.
        </div>
      )}

      {/* ── 상담 신청 접수 ── */}
      <h3 className="admin-section-title">
        상담 신청 접수
        {reqAvailable && newCount > 0 && (
          <span className="admin-section-title__count">신규 {newCount}</span>
        )}
      </h3>

      {!reqAvailable ? (
        <div className="admin-notice admin-notice--warn">
          상담 신청 DB(consult_requests)에 연결되지 않았습니다. AWS 백엔드 배포와 환경변수
          설정(docs/aws-backend.md)을 확인해 주세요.
        </div>
      ) : (
        <div className="admin-table-wrap" style={{ marginBottom: 28 }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>접수일</th>
                <th>성함</th>
                <th>연락처</th>
                <th>전공과목</th>
                <th>개원희망시기</th>
                <th>개원희망지역</th>
                <th>문의 내용</th>
                <th>상태</th>
                <th>관리</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((q) => (
                <tr key={q.id}>
                  <td>{formatLogTime(q.createdAt)}</td>
                  <td>
                    <span className="m-name">{q.name}</span>
                  </td>
                  <td>{q.phone}</td>
                  <td>{q.specialty}</td>
                  <td>{q.openingPeriod}</td>
                  <td>{q.openingRegion}</td>
                  <td title={q.message}>
                    {q.message ? q.message.slice(0, 20) + (q.message.length > 20 ? '…' : '') : '-'}
                  </td>
                  <td>
                    <span
                      className={`iq-badge ${q.status === 'done' ? 'iq-badge--answered' : 'iq-badge--open'}`}
                    >
                      {q.status === 'done' ? '처리완료' : '신규'}
                    </span>
                  </td>
                  <td>
                    <div className="admin-actions">
                      <button className="activate" onClick={() => writeFromRequest(q)}>
                        상담 기록 작성
                      </button>
                      <button onClick={() => toggleRequestStatus(q)}>
                        {q.status === 'done' ? '신규로' : '처리완료'}
                      </button>
                      <button className="danger" onClick={() => removeRequest(q)}>
                        삭제
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {requests.length === 0 && <div className="admin-empty">접수된 상담 신청이 없습니다.</div>}
        </div>
      )}

      {/* ── 상담 기록 (회의록) ── */}
      <h3 className="admin-section-title">상담 기록</h3>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>일시</th>
              <th>원장</th>
              <th>전공과목</th>
              <th>개원희망지역</th>
              <th>개원희망시기</th>
              <th>장소</th>
              <th>관리</th>
            </tr>
          </thead>
          <tbody>
            {consults.map((c) => (
              <tr key={c.id}>
                <td>{formatDateTime(c.fields.datetime)}</td>
                <td>
                  <span className="m-name">{c.fields.doctorName}</span>
                </td>
                <td>{c.fields.specialty || '-'}</td>
                <td>{c.fields.region || '-'}</td>
                <td>{c.fields.period || '-'}</td>
                <td>{c.fields.place || '-'}</td>
                <td>
                  <div className="admin-actions">
                    <button onClick={() => setWriting({ mode: 'edit', consult: c })}>
                      보기·수정
                    </button>
                    <button className="danger" onClick={() => removeConsult(c.id)}>
                      삭제
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {consults.length === 0 && <div className="admin-empty">작성된 상담 기록이 없습니다.</div>}
      </div>
    </>
  )
}

// ─────────────────────────────────────────────────────────
// 상담 관리 > 1:1 상담 — 회원 비공개 문의 접수·답변
// ─────────────────────────────────────────────────────────
function formatLogTime(iso) {
  const d = new Date(iso)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

export function ConsultDirectAdmin() {
  const [items, setItems] = useState([])
  const [available, setAvailable] = useState(true) // inquiries 테이블 사용 가능 여부
  const [drafts, setDrafts] = useState({}) // id → 답변 초안
  const [busyId, setBusyId] = useState(null)

  useEffect(() => {
    fetchAllInquiries().then((rows) => {
      if (rows === null) setAvailable(false)
      else setItems(rows)
    })
  }, [])

  const saveAnswer = async (q) => {
    const answer = (drafts[q.id] ?? q.answer).trim()
    if (!answer) return
    setBusyId(q.id)
    const r = await answerInquiry(q.id, answer)
    setBusyId(null)
    if (r.ok) {
      setItems((ls) =>
        ls.map((it) => (it.id === q.id ? { ...it, answer, status: 'answered' } : it)),
      )
    } else {
      window.alert(`답변 저장 실패: ${r.error}`)
    }
  }

  const remove = async (q) => {
    if (!window.confirm(`'${q.title}' 문의를 삭제하시겠습니까?`)) return
    setItems((ls) => ls.filter((it) => it.id !== q.id))
    deleteInquiry(q.id)
  }

  const waiting = items.filter((q) => q.status !== 'answered').length

  return (
    <>
      <div className="admin-head">
        <div>
          <h1>1:1 상담</h1>
          <p>회원이 접수한 비공개 문의에 답변합니다. 답변은 회원의 1:1 상담 창에 표시됩니다.</p>
        </div>
      </div>

      {!available ? (
        <div className="admin-notice admin-notice--warn">
          1:1 문의 DB(inquiries)에 연결되지 않았습니다. AWS 백엔드 배포와 환경변수
          설정(docs/aws-backend.md)을 확인해 주세요.
        </div>
      ) : (
        <>
          <div className="admin-stats">
            <div className="admin-stat">
              <b>{items.length}</b>
              <span>전체 문의</span>
            </div>
            <div className="admin-stat">
              <b>{waiting}</b>
              <span>답변 대기</span>
            </div>
            <div className="admin-stat">
              <b>{items.length - waiting}</b>
              <span>답변 완료</span>
            </div>
          </div>

          {items.length === 0 ? (
            <div className="admin-table-wrap">
              <div className="admin-empty">접수된 1:1 문의가 없습니다.</div>
            </div>
          ) : (
            <ul className="inquiry-admin-list">
              {items.map((q) => (
                <li key={q.id} className="inquiry-admin-item">
                  <div className="inquiry-item__head">
                    <div>
                      <span className="inquiry-item__date">{formatLogTime(q.createdAt)}</span>
                      <span className="inquiry-admin-item__member">
                        {q.name} ({q.email})
                      </span>
                    </div>
                    <div className="inquiry-admin-item__actions">
                      <span
                        className={`iq-badge ${q.status === 'answered' ? 'iq-badge--answered' : 'iq-badge--open'}`}
                      >
                        {q.status === 'answered' ? '답변완료' : '답변대기'}
                      </span>
                      <button className="danger call-log__delete" onClick={() => remove(q)}>
                        삭제
                      </button>
                    </div>
                  </div>
                  <b className="inquiry-item__title">{q.title}</b>
                  <p className="inquiry-item__content">{q.content}</p>
                  <div className="inquiry-admin-item__answer">
                    <textarea
                      className="call-log__input"
                      placeholder="답변을 입력하세요"
                      rows={3}
                      value={drafts[q.id] ?? q.answer}
                      onChange={(e) => setDrafts((d) => ({ ...d, [q.id]: e.target.value }))}
                    />
                    <button
                      className="btn btn--primary"
                      onClick={() => saveAnswer(q)}
                      disabled={busyId === q.id || !(drafts[q.id] ?? q.answer).trim()}
                    >
                      {busyId === q.id
                        ? '저장 중...'
                        : q.status === 'answered'
                          ? '답변 수정'
                          : '답변 저장'}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </>
  )
}
