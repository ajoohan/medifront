import { useEffect, useState } from 'react'
import { formatPhone } from '../../lib/phone'
import { forgotPassword, isAuthConfigured } from '../../lib/authClient'
import { fetchLogs, insertLog, deleteLogDb } from '../../lib/membersDb'

const GRADES = ['의사', '병원', '일반']

// 전화 로그 브라우저 저장 폴백 (member_logs 테이블 미생성 시)
const LOG_KEY = 'medifront_call_logs'
function loadLocalLogs(email) {
  try {
    return (JSON.parse(localStorage.getItem(LOG_KEY)) || {})[email] || []
  } catch {
    return []
  }
}
function saveLocalLogs(email, logs) {
  try {
    const all = JSON.parse(localStorage.getItem(LOG_KEY)) || {}
    all[email] = logs
    localStorage.setItem(LOG_KEY, JSON.stringify(all))
  } catch {
    // 저장 공간 부족 시 보존 생략
  }
}

function formatDateTime(iso) {
  const d = new Date(iso)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

function formatJoined(iso) {
  if (!iso) return '-'
  const [y, m, d] = iso.split('-')
  return `${y}.${m}.${d}`
}

// 회원 상세 — 가입 정보 수정 · 비밀번호 재설정 · 전화 로그
export default function MemberDetail({ member, onBack, onSave }) {
  const [form, setForm] = useState({
    name: member.name,
    phone: member.phone === '-' ? '' : member.phone,
    hospital: member.hospital === '-' ? '' : member.hospital,
    specialty: member.specialty === '-' ? '' : member.specialty,
    grade: member.grade,
    status: member.status,
  })
  const [logs, setLogs] = useState([])
  const [logsDb, setLogsDb] = useState(false)
  const [logText, setLogText] = useState('')
  const [notice, setNotice] = useState(null) // { type: 'ok' | 'warn', text }
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let mounted = true
    fetchLogs(member.id).then((list) => {
      if (!mounted) return
      if (list) {
        setLogs(list)
        setLogsDb(true)
      } else {
        setLogs(loadLocalLogs(member.email))
      }
    })
    return () => {
      mounted = false
    }
  }, [member.id, member.email])

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const save = () => {
    const patch = {
      name: form.name.trim() || member.name,
      phone: form.phone.trim() || '-',
      hospital: form.hospital.trim() || '-',
      specialty: form.specialty.trim() || '-',
      grade: form.grade,
      status: form.status,
    }
    onSave(member.id, patch)
    setNotice({ type: 'ok', text: '회원 정보를 저장했습니다.' })
  }

  // 비밀번호 재설정 코드 메일 — 회원이 /reset-password 페이지에서 코드로 새 비밀번호 설정
  const sendPasswordReset = async () => {
    if (!isAuthConfigured) {
      setNotice({ type: 'warn', text: '인증 서버 미연결로 메일을 발송할 수 없습니다.' })
      return
    }
    setBusy(true)
    const r = await forgotPassword(member.email)
    setBusy(false)
    setNotice(
      r.error
        ? { type: 'warn', text: `비밀번호 재설정 메일 발송 실패: ${r.error}` }
        : {
            type: 'ok',
            text: `${member.email} 로 재설정 코드를 발송했습니다. 회원이 사이트의 [아이디/비밀번호 찾기] 또는 /reset-password 페이지에서 코드를 입력해 새 비밀번호를 설정합니다.`,
          },
    )
  }

  // ── 전화 로그 ──
  const addLog = async () => {
    const content = logText.trim()
    if (!content) return
    if (logsDb) {
      const res = await insertLog(member.id, content)
      if (res.ok) setLogs((ls) => [res.log, ...ls])
      else setNotice({ type: 'warn', text: `로그 저장 실패: ${res.error}` })
    } else {
      const next = [{ id: Date.now(), at: new Date().toISOString(), content }, ...logs]
      setLogs(next)
      saveLocalLogs(member.email, next)
    }
    setLogText('')
  }

  const removeLog = (id) => {
    if (!window.confirm('이 전화 로그를 삭제하시겠습니까?')) return
    const next = logs.filter((l) => l.id !== id)
    setLogs(next)
    if (logsDb) deleteLogDb(id)
    else saveLocalLogs(member.email, next)
  }

  return (
    <>
      <div className="admin-head">
        <div>
          <h1>회원 상세</h1>
          <p>
            {member.email} · 가입일 {formatJoined(member.joinedAt)}
          </p>
        </div>
        <button className="btn admin-add__cancel admin-head__action" onClick={onBack}>
          ← 목록으로
        </button>
      </div>

      {notice && (
        <div className={`admin-notice admin-notice--${notice.type}`}>
          {notice.text}
          <button className="admin-notice__close" onClick={() => setNotice(null)} aria-label="닫기">
            ✕
          </button>
        </div>
      )}

      {/* 가입 정보 */}
      <div className="admin-add">
        <h3 className="consult-editor__section">가입 정보</h3>
        <div className="admin-add__grid">
          <label className="admin-add__field">
            <span>이름</span>
            <input type="text" value={form.name} onChange={set('name')} />
          </label>
          <label className="admin-add__field">
            <span>이메일 (아이디)</span>
            <input type="email" value={member.email} readOnly disabled />
          </label>
          <label className="admin-add__field">
            <span>연락처</span>
            <input
              type="tel"
              inputMode="numeric"
              placeholder="010-0000-0000"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: formatPhone(e.target.value) }))}
            />
          </label>
          <label className="admin-add__field">
            <span>병원명</span>
            <input
              type="text"
              placeholder="OO의원"
              value={form.hospital}
              onChange={set('hospital')}
            />
          </label>
          <label className="admin-add__field">
            <span>전공과목</span>
            <input
              type="text"
              placeholder="내과"
              value={form.specialty}
              onChange={set('specialty')}
            />
          </label>
          <label className="admin-add__field">
            <span>회원유형</span>
            <select value={form.grade} onChange={set('grade')}>
              {GRADES.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </label>
          <label className="admin-add__field">
            <span>상태</span>
            <select value={form.status} onChange={set('status')}>
              <option value="active">활성</option>
              <option value="suspended">정지</option>
            </select>
          </label>
        </div>
        <div className="admin-add__actions">
          <button className="btn btn--primary" onClick={save}>
            저장
          </button>
          <button className="btn admin-add__cancel" onClick={sendPasswordReset} disabled={busy}>
            {busy ? '발송 중...' : '비밀번호 재설정 메일 발송'}
          </button>
        </div>
        <p className="admin-add__hint">
          비밀번호는 보안상 관리자가 직접 볼 수 없으며, 재설정 메일을 통해 회원이 새 비밀번호를
          설정합니다.
        </p>
      </div>

      {/* 전화 로그 */}
      <div className="admin-add" style={{ marginTop: 16 }}>
        <h3 className="consult-editor__section">전화 로그</h3>
        <div className="call-log__form">
          <textarea
            className="call-log__input"
            placeholder="통화 내용을 기록하세요. (예: 개원 입지 관련 상담, 다음 주 화요일 재통화 예정)"
            value={logText}
            onChange={(e) => setLogText(e.target.value)}
            rows={3}
          />
          <button className="btn btn--primary" onClick={addLog} disabled={!logText.trim()}>
            기록 추가
          </button>
        </div>

        {logs.length === 0 ? (
          <div className="admin-empty">기록된 전화 로그가 없습니다.</div>
        ) : (
          <ul className="call-log__list">
            {logs.map((l) => (
              <li key={l.id} className="call-log__item">
                <div>
                  <span className="call-log__date">{formatDateTime(l.at)}</span>
                  <p className="call-log__content">{l.content}</p>
                </div>
                <button className="danger call-log__delete" onClick={() => removeLog(l.id)}>
                  삭제
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}
