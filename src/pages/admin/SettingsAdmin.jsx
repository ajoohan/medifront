import { useState } from 'react'
import { loadOperators, saveOperators } from '../../lib/operatorStore'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'

// 운영자 등급: 마스터(전체 권한) / 매니저
const OPERATOR_GRADES = ['마스터', '매니저']
const GRADE_CLASS = { 마스터: 'master', 매니저: 'manager' }

const EMPTY_DRAFT = { name: '', email: '', phone: '', grade: '매니저' }

function formatDate(iso) {
  const [y, m, d] = iso.split('-')
  return `${y}.${m}.${d}`
}

// 운영자 등록 안내 메일 — Supabase OTP(매직링크) 메일로 발송
// ※ 메일 문구는 Supabase 대시보드 > Authentication > Email Templates > Magic Link 에서 수정
async function sendOperatorMail({ email, name }) {
  if (!isSupabaseConfigured) return { error: 'not-configured' }
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true, data: { name, grade: '일반' } },
  })
  return error ? { error: error.message } : { ok: true }
}

export default function SettingsAdmin() {
  const [operators, setOperators] = useState(loadOperators)
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState(EMPTY_DRAFT)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState(null) // { type: 'ok' | 'warn', text }

  const setD = (key) => (e) => setDraft((d) => ({ ...d, [key]: e.target.value }))

  const persist = (next) => {
    setOperators(next)
    saveOperators(next)
  }

  const addOperator = async (e) => {
    e.preventDefault()
    const email = draft.email.trim()
    if (operators.some((o) => o.email === email)) {
      window.alert('이미 등록된 이메일입니다.')
      return
    }
    const newOp = {
      id: Math.max(0, ...operators.map((o) => o.id)) + 1,
      name: draft.name.trim(),
      email,
      phone: draft.phone.trim() || '-',
      grade: draft.grade,
      createdAt: new Date().toISOString().slice(0, 10),
    }
    setBusy(true)
    const mail = await sendOperatorMail(newOp)
    setBusy(false)

    persist([newOp, ...operators])
    setDraft(EMPTY_DRAFT)
    setAdding(false)
    if (mail.ok) {
      setNotice({
        type: 'ok',
        text: `운영자 등록 완료 — ${email} 로 등록 안내 메일을 발송했습니다.`,
      })
    } else if (mail.error === 'not-configured') {
      setNotice({
        type: 'warn',
        text: '운영자 등록 완료 — 인증 서버 미연결로 안내 메일은 발송되지 않았습니다.',
      })
    } else {
      setNotice({ type: 'warn', text: `운영자 등록 완료 — 안내 메일 발송 실패: ${mail.error}` })
    }
  }

  const changeGrade = (id, grade) => {
    persist(operators.map((o) => (o.id === id ? { ...o, grade } : o)))
  }

  const removeOperator = (id) => {
    const target = operators.find((o) => o.id === id)
    if (window.confirm(`'${target?.name}' 운영자를 삭제하시겠습니까?`)) {
      persist(operators.filter((o) => o.id !== id))
    }
  }

  return (
    <>
      <div className="admin-head">
        <div>
          <h1>설정</h1>
          <p>운영자 계정을 등록하고 관리합니다.</p>
        </div>
        <button
          className="btn btn--primary admin-head__action"
          onClick={() => setAdding((a) => !a)}
        >
          {adding ? '추가 취소' : '+ 운영자 추가'}
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

      {adding && (
        <form className="admin-add" onSubmit={addOperator}>
          <div className="admin-add__grid">
            <label className="admin-add__field">
              <span>
                이름 <b className="req">*</b>
              </span>
              <input
                type="text"
                required
                placeholder="홍길동"
                value={draft.name}
                onChange={setD('name')}
              />
            </label>
            <label className="admin-add__field">
              <span>
                이메일 <b className="req">*</b>
              </span>
              <input
                type="email"
                required
                placeholder="operator@example.com"
                value={draft.email}
                onChange={setD('email')}
              />
            </label>
            <label className="admin-add__field">
              <span>전화번호</span>
              <input
                type="tel"
                placeholder="010-0000-0000"
                value={draft.phone}
                onChange={setD('phone')}
              />
            </label>
            <label className="admin-add__field">
              <span>등급</span>
              <select value={draft.grade} onChange={setD('grade')}>
                {OPERATOR_GRADES.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="admin-add__actions">
            <button type="submit" className="btn btn--primary" disabled={busy}>
              {busy ? '등록 중...' : '운영자 등록'}
            </button>
            <button
              type="button"
              className="btn admin-add__cancel"
              onClick={() => {
                setDraft(EMPTY_DRAFT)
                setAdding(false)
              }}
            >
              취소
            </button>
          </div>
          <p className="admin-add__hint">
            등록 시 입력한 이메일로 운영자 등록 안내 메일이 발송됩니다.
          </p>
        </form>
      )}

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>이름</th>
              <th>이메일</th>
              <th>전화번호</th>
              <th>등급</th>
              <th>등록일</th>
              <th>관리</th>
            </tr>
          </thead>
          <tbody>
            {operators.map((o) => (
              <tr key={o.id}>
                <td>
                  <span className="m-name">{o.name}</span>
                </td>
                <td>{o.email}</td>
                <td>{o.phone}</td>
                <td>
                  <select
                    className={`grade-select grade--${GRADE_CLASS[o.grade]}`}
                    value={o.grade}
                    onChange={(e) => changeGrade(o.id, e.target.value)}
                    aria-label={`${o.name} 등급`}
                  >
                    {OPERATOR_GRADES.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </td>
                <td>{formatDate(o.createdAt)}</td>
                <td>
                  <div className="admin-actions">
                    <button className="danger" onClick={() => removeOperator(o.id)}>
                      삭제
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {operators.length === 0 && <div className="admin-empty">등록된 운영자가 없습니다.</div>}
      </div>
    </>
  )
}
