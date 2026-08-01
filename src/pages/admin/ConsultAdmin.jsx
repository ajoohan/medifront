import { useMemo, useRef, useState } from 'react'
import { loadConsults, saveConsults } from '../../lib/consultStore'
import { fileToDataUrl, MAX_IMAGE_BYTES } from '../../lib/imageUtils'
import { SPECIALTIES, REGIONS } from '../../data'
import { formatPhone } from '../../lib/phone'
import { fetchAllInquiries, answerInquiry, deleteInquiry } from '../../lib/inquiriesDb'
import { fetchMembers } from '../../lib/membersDb'
import { fetchRequests, updateRequestStatus, deleteRequest } from '../../lib/requestsDb'
import {
  fetchConsultsDb,
  insertConsultDb,
  updateConsultDb,
  deleteConsultDb,
} from '../../lib/consultsDb'
import useAdminData from '../../hooks/useAdminData'
import { CK, clearCache } from '../../lib/adminCache'
import { SkeletonTable, LoadingRegion } from '../../components/admin/Skeleton'

// 대면 상담 목록 로드 — DB가 비어 있고 브라우저 저장분이 있으면 1회 자동 이전한다.
// DB 미연결(null)이면 호출부가 브라우저 저장분으로 폴백한다.
async function loadConsultsWithMigration() {
  const list = await fetchConsultsDb()
  if (!list) return null
  const local = loadConsults()
  if (list.length > 0 || local.length === 0) return list

  const uploaded = []
  let allOk = true
  for (const c of local) {
    const r = await insertConsultDb(c)
    if (r.ok) uploaded.push(r.consult)
    else allOk = false
  }
  if (allOk) saveConsults([]) // 이전 완료 → 브라우저 저장 비움
  return uploaded
}

// 상담 시각 옵션 — 30분 단위. 06:00~23:30 이면 이른 조찬부터 늦은 저녁 상담까지 담긴다.
const TIME_SLOTS = (() => {
  const list = []
  for (let m = 6 * 60; m <= 23 * 60 + 30; m += 30) {
    const h = String(Math.floor(m / 60)).padStart(2, '0')
    list.push(`${h}:${m % 60 === 0 ? '00' : '30'}`)
  }
  return list
})()

// 저장 형식은 기존 그대로 'YYYY-MM-DDTHH:mm' 이다.
// 화면에서만 날짜(달력)와 시각(30분 단위)으로 나눠 받는다.
const splitDateTime = (v) => {
  const [date = '', time = ''] = String(v || '').split('T')
  return { date, time: time.slice(0, 5) }
}
const joinDateTime = (date, time) => (date && time ? `${date}T${time}` : '')

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

  // 일시 — 저장은 'YYYY-MM-DDTHH:mm' 한 값이고, 입력만 날짜/시각으로 나눈다
  const when = splitDateTime(draft.datetime)
  const setWhen = (date, time) => setDraft((d) => ({ ...d, datetime: joinDateTime(date, time) }))

  // 원장 후보 — 면허 확인을 마친 '의사' 등급 회원 (회원관리와 같은 캐시를 쓴다)
  const { data: memberData } = useAdminData(CK.members, fetchMembers)
  const doctors = useMemo(
    () =>
      (memberData || [])
        .filter((m) => m.grade === '의사')
        .sort((a, b) => a.name.localeCompare(b.name, 'ko')),
    [memberData],
  )
  // 이미 채워진 이메일이 회원 목록에 있으면 그 회원이 선택된 것으로 본다(수정 화면 대응)
  const pickedDoctor = doctors.some((m) => m.email === draft.doctorEmail) ? draft.doctorEmail : ''

  const pickDoctor = (email) => {
    if (!email) return // '직접 입력' — 이미 적은 값을 지우지 않는다
    const m = doctors.find((d) => d.email === email)
    if (!m) return
    setDraft((d) => ({
      ...d,
      doctorName: m.name,
      doctorPhone: m.phone && m.phone !== '-' ? formatPhone(m.phone) : '',
      doctorEmail: m.email,
      // 회원 정보에 진료과목이 있으면 상담 개요도 함께 채워 준다
      specialty: m.specialty && m.specialty !== '-' ? m.specialty : d.specialty,
    }))
  }

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
      window.alert('상담 날짜와 시각을 모두 선택해 주세요.')
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
              날짜 <b className="req">*</b>
            </span>
            <input
              type="date"
              required
              value={when.date}
              onChange={(e) => setWhen(e.target.value, when.time)}
            />
          </label>
          <label className="admin-add__field">
            <span>
              시각 <b className="req">*</b>
            </span>
            <select required value={when.time} onChange={(e) => setWhen(when.date, e.target.value)}>
              <option value="">선택</option>
              {/* 30분 단위로 바꾸기 전에 저장된 기록은 14:20 같은 시각일 수 있다.
                  목록에 없다고 버리면 수정할 때 조용히 사라지므로 그 값도 함께 넣는다. */}
              {when.time && !TIME_SLOTS.includes(when.time) && (
                <option value={when.time}>{when.time} (기존 기록)</option>
              )}
              {TIME_SLOTS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
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
        {/* 가입된 의사 회원에서 고르면 아래 세 칸이 자동으로 채워진다.
            미가입 원장은 '직접 입력'으로 그대로 타이핑하면 된다. */}
        <div className="admin-add__grid">
          <label className="admin-add__field admin-add__field--wide">
            <span>가입 회원에서 선택</span>
            <select value={pickedDoctor} onChange={(e) => pickDoctor(e.target.value)}>
              <option value="">직접 입력</option>
              {doctors.map((m) => (
                <option key={m.id} value={m.email}>
                  {m.name}
                  {m.hospital && m.hospital !== '-' ? ` · ${m.hospital}` : ''} ({m.email})
                </option>
              ))}
            </select>
            {doctors.length === 0 && (
              <small className="admin-add__note">
                의사 등급 회원이 아직 없습니다. 회원관리에서 면허를 확인해 승인하면 여기에 나옵니다.
              </small>
            )}
          </label>
        </div>
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
  const { data, status, setData } = useAdminData(CK.consults, loadConsultsWithMigration)
  const dbReady = !!data // consults 테이블 사용 가능 여부
  const checked = status === 'ready'
  const consults = useMemo(() => data || (checked ? loadConsults() : []), [data, checked])
  const setConsults = (next) =>
    setData((cur) => (typeof next === 'function' ? next(cur || []) : next))
  // writing: null | { mode: 'new', fromRequest?, prefill? } | { mode: 'edit', consult }
  const [writing, setWriting] = useState(null)

  // 상담 신청 접수 (consult_requests)
  const { data: reqData, setData: setReqData } = useAdminData(CK.requests, fetchRequests)
  const requests = reqData || []
  const reqAvailable = reqData !== null
  const setRequests = (next) => {
    setReqData((cur) => (typeof next === 'function' ? next(cur || []) : next))
    clearCache(CK.dashboard) // 신규 상담 신청 수가 대시보드에도 나온다
  }

  const update = (list) => {
    setConsults(list)
    clearCache(CK.dashboard)
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

      {reqData === undefined ? (
        <LoadingRegion label="상담 신청 불러오는 중">
          <SkeletonTable rows={4} cols={9} />
        </LoadingRegion>
      ) : !reqAvailable ? (
        <div className="admin-notice admin-notice--warn">
          상담 신청 DB(consult_requests)에 연결되지 않았습니다. AWS 백엔드 배포와 환경변수
          설정(docs/aws-backend.md)을 확인해 주세요.
        </div>
      ) : (
        <div className="admin-table-wrap admin-fade" style={{ marginBottom: 28 }}>
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

      {!checked ? (
        <LoadingRegion label="상담 기록 불러오는 중">
          <SkeletonTable rows={5} cols={7} />
        </LoadingRegion>
      ) : (
        <div className="admin-table-wrap admin-fade">
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
      )}
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
  const { data, status, fresh, setData } = useAdminData(CK.inquiries, fetchAllInquiries)
  const items = data || []
  const available = data !== null // inquiries 테이블 사용 가능 여부
  const loading = status === 'loading'
  const setItems = (next) => {
    setData((cur) => (typeof next === 'function' ? next(cur || []) : next))
    clearCache(CK.dashboard) // 미답변 문의 수가 대시보드에도 나온다
  }
  const [drafts, setDrafts] = useState({}) // id → 답변 초안
  const [busyId, setBusyId] = useState(null)

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

      {!fresh && !loading && <div className="admin-refresh" aria-label="최신 목록을 받는 중" />}

      {loading ? (
        <LoadingRegion label="1:1 문의 불러오는 중">
          <SkeletonTable rows={5} cols={4} />
        </LoadingRegion>
      ) : !available ? (
        <div className="admin-notice admin-notice--warn">
          1:1 문의 DB(inquiries)에 연결되지 않았습니다. AWS 백엔드 배포와 환경변수
          설정(docs/aws-backend.md)을 확인해 주세요.
        </div>
      ) : (
        <>
          <div className="admin-stats admin-fade">
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
