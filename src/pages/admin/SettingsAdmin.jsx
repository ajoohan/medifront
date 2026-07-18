import { useEffect, useState } from 'react'
import { apiSend, isApiConfigured } from '../../lib/api'
import { fetchMembers } from '../../lib/membersDb'
import {
  fetchOperatorsDb,
  insertOperatorDb,
  updateOperatorDb,
  deleteOperatorDb,
} from '../../lib/operatorsDb'

// 관리자 등급: 최고관리자 / 일반관리자 / 운영자
// 세 등급의 권한은 현재 모두 동일하다 — 등급별 권한 분리는 이후 작업이며,
// 백엔드는 이미 등급을 JWT 역할 그룹으로 반영해 두었다(backend/src/index.mjs 의 ROLE_BY_GROUP).
// 값을 바꾸면 백엔드의 ROLE_BY_GROUP 도 함께 바꿔야 한다.
const OPERATOR_GRADES = ['최고관리자', '일반관리자', '운영자']
const GRADE_CLASS = { 최고관리자: 'super', 일반관리자: 'master', 운영자: 'manager' }

// mode: 'member' = 등록된 회원 중 선택 / 'invite' = 미가입자 이메일 직접 초대
// member 모드에선 email = 선택한 회원 이메일, invite 모드에선 name/email 직접 입력
const EMPTY_DRAFT = { mode: 'member', email: '', name: '', grade: '운영자' }

function formatDate(iso) {
  if (!iso) return '-'
  const [y, m, d] = iso.split('-')
  return `${y}.${m}.${d}`
}

// (1) 기존 회원 → 권한(역할 그룹)만 부여. 회원은 이미 계정이 있어 새 계정/임시비번 없음.
async function grantOperator({ email, grade }) {
  if (!isApiConfigured) return { error: 'not-configured' }
  const r = await apiSend('POST', '/auth/grant', { email, grade })
  return r.error ? { error: r.error } : { ok: true }
}

// (2) 신규(미가입) → 새 Cognito 계정 생성 + 임시 비밀번호 초대 메일 발송 + 역할 부여.
async function inviteNewOperator({ email, name, grade }) {
  if (!isApiConfigured) return { error: 'not-configured' }
  const r = await apiSend('POST', '/auth/invite', { email, name, grade })
  return r.error ? { error: r.error } : { ok: true }
}

export default function SettingsAdmin() {
  const [operators, setOperators] = useState([])
  const [members, setMembers] = useState([]) // 운영자로 지정할 후보(등록된 회원)
  const [dbReady, setDbReady] = useState(false) // operators 테이블 사용 가능 여부
  const [checked, setChecked] = useState(false)
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState(EMPTY_DRAFT)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState(null) // { type: 'ok' | 'warn', text }

  // DB 로드. 조회 실패 시 예전에는 브라우저 저장분으로 폴백했는데, 그 상태에서 운영자를
  // 추가하면 목록에는 보이지만 Cognito 계정도 역할 그룹도 만들어지지 않아 관리자가
  // 등록됐다고 오해하게 된다. 실패는 빈 목록 + 오류 안내로 정직하게 드러낸다.
  useEffect(() => {
    fetchOperatorsDb().then((list) => {
      if (list) {
        setDbReady(true)
        setOperators(list)
      } else {
        setOperators([])
      }
      setChecked(true)
    })
    // 운영자는 등록된 회원 중에서만 지정한다 → 회원 목록을 후보로 불러온다
    fetchMembers().then((list) => setMembers(list || []))
  }, [])

  // 아직 운영자가 아닌 회원만 후보로 (이미 운영자면 목록에서 제외)
  const candidates = members.filter((m) => !operators.some((o) => o.email === m.email))

  const setD = (key) => (e) => setDraft((d) => ({ ...d, [key]: e.target.value }))

  const persist = (next) => setOperators(next)

  const addOperator = async (e) => {
    e.preventDefault()
    if (!dbReady) {
      setNotice({ type: 'warn', text: '운영자 DB에 연결되지 않아 등록할 수 없습니다.' })
      return
    }

    // 모드별로 운영자 정보 확정
    let info // { name, email, phone }
    if (draft.mode === 'member') {
      const member = members.find((m) => m.email === draft.email)
      if (!member) {
        window.alert('운영자로 지정할 회원을 선택해 주세요.')
        return
      }
      info = { name: member.name, email: member.email, phone: member.phone || '-' }
    } else {
      const email = draft.email.trim()
      const name = draft.name.trim()
      if (!email || !name) {
        window.alert('이름과 이메일을 입력해 주세요.')
        return
      }
      info = { name, email, phone: '-' }
    }

    if (operators.some((o) => o.email === info.email)) {
      window.alert('이미 운영자로 등록된 이메일입니다.')
      return
    }

    let newOp = {
      id: Math.max(0, ...operators.map((o) => o.id)) + 1,
      ...info,
      grade: draft.grade,
      createdAt: new Date().toISOString().slice(0, 10),
    }
    setBusy(true)
    // 목록(DB) 저장을 먼저 한다. 권한 부여/초대가 Cognito 그룹·계정을 만들므로, 그걸 먼저
    // 하면 저장 실패 시 '권한은 있는데 목록에 없는' 계정이 남아 회수할 수 없다.
    const res = await insertOperatorDb({ ...newOp, createdAt: undefined })
    if (!res.ok) {
      setBusy(false)
      setNotice({ type: 'warn', text: `운영자 저장 실패: ${res.error}` })
      return
    }
    newOp = res.operator

    const r =
      draft.mode === 'member'
        ? await grantOperator({ email: info.email, grade: draft.grade })
        : await inviteNewOperator({ email: info.email, name: info.name, grade: draft.grade })
    setBusy(false)

    persist([newOp, ...operators])
    setDraft(EMPTY_DRAFT)
    setAdding(false)
    if (r.ok) {
      setNotice({
        type: 'ok',
        text:
          draft.mode === 'member'
            ? `${info.name} 회원을 ${draft.grade}(으)로 지정했습니다.`
            : `${info.email} 로 운영자 초대 메일을 발송했습니다.`,
      })
    } else if (r.error === 'already-registered') {
      setNotice({
        type: 'warn',
        text: '이미 가입된 이메일입니다. "기존 회원 지정"에서 선택해 주세요.',
      })
    } else if (r.error === 'not-configured') {
      setNotice({
        type: 'warn',
        text: '목록에 추가했으나, 인증 서버 미연결로 권한 반영에 실패했습니다.',
      })
    } else {
      setNotice({ type: 'warn', text: `목록에 추가했으나 처리 실패: ${r.error}` })
    }
  }

  // 등급 변경·삭제는 DB 에 반영돼야 Cognito 역할 그룹도 함께 바뀐다(backend patchItem/deleteItem).
  // DB 미연결 시 화면만 바꾸면 실제 권한은 그대로여서 오해를 부르므로 막는다.
  const changeGrade = (id, grade) => {
    if (!dbReady) {
      setNotice({ type: 'warn', text: '운영자 DB에 연결되지 않아 등급을 변경할 수 없습니다.' })
      return
    }
    persist(operators.map((o) => (o.id === id ? { ...o, grade } : o)))
    updateOperatorDb(id, { grade })
  }

  const removeOperator = (id) => {
    if (!dbReady) {
      setNotice({ type: 'warn', text: '운영자 DB에 연결되지 않아 삭제할 수 없습니다.' })
      return
    }
    const target = operators.find((o) => o.id === id)
    if (window.confirm(`'${target?.name}' 운영자를 삭제하시겠습니까?`)) {
      persist(operators.filter((o) => o.id !== id))
      deleteOperatorDb(id)
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

      {checked && !dbReady && (
        <div className="admin-notice admin-notice--warn">
          운영자 DB(operators)를 불러오지 못했습니다. 이 상태에서는 운영자를 등록·수정할 수
          없습니다. 잠시 후 새로고침해 주세요.
        </div>
      )}

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
          {/* 두 경로: 기존 회원 지정 / 신규(미가입) 초대 */}
          <div className="admin-add__modes">
            <button
              type="button"
              className={`admin-mode ${draft.mode === 'member' ? 'is-active' : ''}`}
              onClick={() => setDraft((d) => ({ ...d, mode: 'member', email: '', name: '' }))}
            >
              기존 회원 지정
            </button>
            <button
              type="button"
              className={`admin-mode ${draft.mode === 'invite' ? 'is-active' : ''}`}
              onClick={() => setDraft((d) => ({ ...d, mode: 'invite', email: '', name: '' }))}
            >
              신규 초대
            </button>
          </div>

          <div className="admin-add__grid">
            {draft.mode === 'member' ? (
              <label className="admin-add__field">
                <span>
                  회원 선택 <b className="req">*</b>
                </span>
                {candidates.length === 0 ? (
                  <p className="admin-add__nomember">
                    지정할 수 있는 회원이 없습니다. (등록된 회원이 없거나 모두 이미 운영자)
                  </p>
                ) : (
                  <select value={draft.email} onChange={setD('email')} required>
                    <option value="">회원을 선택하세요</option>
                    {candidates.map((m) => (
                      <option key={m.email} value={m.email}>
                        {m.name} · {m.email}
                      </option>
                    ))}
                  </select>
                )}
              </label>
            ) : (
              <>
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
              </>
            )}
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
            <button
              type="submit"
              className="btn btn--primary"
              disabled={busy || (draft.mode === 'member' && candidates.length === 0)}
            >
              {busy ? '처리 중...' : draft.mode === 'member' ? '운영자로 지정' : '초대 메일 발송'}
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
            {draft.mode === 'member'
              ? '선택한 회원에게 운영자 권한이 부여됩니다. 회원은 기존 계정으로 로그인해 이용합니다.'
              : '입력한 이메일로 임시 비밀번호가 담긴 초대 메일이 발송됩니다. 첫 로그인 시 새 비밀번호를 설정합니다.'}
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
