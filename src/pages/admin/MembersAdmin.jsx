import { useEffect, useMemo, useState } from 'react'
import { MOCK_MEMBERS } from '../../mock/members'
import { formatPhone } from '../../lib/phone'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import { fetchMembers, upsertMember, updateMemberDb, deleteMemberDb } from '../../lib/membersDb'
import MemberDetail from './MemberDetail'

// 수동 추가 회원의 기본 비밀번호 (첫 로그인 후 아이디/비밀번호 찾기로 변경 안내)
const DEFAULT_PASSWORD = 'medifront2026'

// 수동 추가 회원의 실제 로그인 계정 생성 (인증 메일 자동 발송)
async function createLoginAccount({ email, name, phone, grade, password }) {
  if (!isSupabaseConfigured) return { error: 'not-configured' }
  const { data, error } = await supabase.auth.signUp({
    email,
    password: password || DEFAULT_PASSWORD,
    options: {
      data: { name, phone, grade },
      emailRedirectTo: window.location.origin,
    },
  })
  if (error) return { error: error.message }
  // 이미 가입된 이메일이면 identities가 빈 배열로 옴
  if (data.user && data.user.identities?.length === 0) return { error: 'already-registered' }
  return { ok: true }
}

const PAGE_SIZE = 20

// 상태 필터 — 클릭 시 토글(다시 누르면 해제되어 전체 표시)
const FILTERS = [
  { key: 'active', label: '활성' },
  { key: 'suspended', label: '정지' },
]

// 회원유형: 의사(의사면허 보유자·모든 서비스) / 병원(병원·의원 소속 관계자) / 일반
const GRADES = ['의사', '병원', '일반']
const GRADE_CLASS = { 의사: 'doctor', 병원: 'hospital', 일반: 'general' }

function formatDate(iso) {
  const [y, m, d] = iso.split('-')
  return `${y}.${m}.${d}`
}

// DB 테이블 생성 전 임시 보존(브라우저 저장) — 새로고침해도 추가/변경이 유지되도록
const LOCAL_KEY = 'medifront_members_local'
function loadLocalMembers() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY))
  } catch {
    return null
  }
}

// 수동 추가 폼 초기값 — password 미입력 시 기본 비밀번호(medifront2026) 사용
const EMPTY_DRAFT = {
  name: '',
  email: '',
  phone: '',
  hospital: '',
  specialty: '',
  grade: '일반',
  password: '',
}

export default function MembersAdmin() {
  const [members, setMembers] = useState(() => loadLocalMembers() || MOCK_MEMBERS)
  const [queryInput, setQueryInput] = useState('')
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('all')
  const [gradeFilter, setGradeFilter] = useState('전체')
  const [selected, setSelected] = useState(() => new Set())
  const [bulkGrade, setBulkGrade] = useState('일반')
  const [page, setPage] = useState(1)
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState(EMPTY_DRAFT)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState(null) // { type: 'ok' | 'warn', text }
  const [dbReady, setDbReady] = useState(false) // members 테이블 사용 가능 여부
  const [detailId, setDetailId] = useState(null) // 상세 보기 중인 회원 id

  // DB(members 테이블)에서 실목록 로드 — 테이블 미생성 시 목업 폴백
  useEffect(() => {
    fetchMembers().then((list) => {
      if (list) {
        setMembers(list)
        setDbReady(true)
      } else if (isSupabaseConfigured) {
        setNotice({
          type: 'warn',
          text: '회원 DB 테이블(members)이 아직 없어 이 브라우저에만 임시 저장됩니다. supabase/members-setup.sql 을 Supabase SQL Editor에서 실행하면 실데이터로 전환됩니다.',
        })
      }
    })
  }, [])

  // DB 미연결 동안에는 목록 변경을 브라우저에 보존 (새로고침 유지)
  useEffect(() => {
    if (dbReady) return
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(members))
    } catch {
      // 저장 공간 부족 시 보존 생략 (동작에는 영향 없음)
    }
  }, [members, dbReady])

  const filtered = useMemo(() => {
    const keyword = q.trim()
    return members.filter((m) => {
      const matchQ =
        !keyword ||
        m.name.includes(keyword) ||
        m.email.includes(keyword) ||
        m.hospital.includes(keyword)
      const matchF = filter === 'all' || m.status === filter
      const matchG = gradeFilter === '전체' || m.grade === gradeFilter
      return matchQ && matchF && matchG
    })
  }, [members, q, filter, gradeFilter])

  // 페이지네이션 (20개씩)
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  // 검색/필터가 바뀌면 첫 페이지로
  useEffect(() => {
    setPage(1)
  }, [q, filter, gradeFilter])

  const activeCount = members.filter((m) => m.status === 'active').length
  const suspendedCount = members.length - activeCount

  const toggleStatus = (id) => {
    const target = members.find((m) => m.id === id)
    const next = target?.status === 'active' ? 'suspended' : 'active'
    setMembers((ms) => ms.map((m) => (m.id === id ? { ...m, status: next } : m)))
    if (dbReady) updateMemberDb(id, { status: next })
  }

  const removeMember = (id) => {
    const target = members.find((m) => m.id === id)
    if (window.confirm(`'${target?.name}' 회원을 삭제하시겠습니까?`)) {
      setMembers((ms) => ms.filter((m) => m.id !== id))
      setSelected((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      if (dbReady) deleteMemberDb(id)
    }
  }

  const changeGrade = (id, grade) => {
    setMembers((ms) => ms.map((m) => (m.id === id ? { ...m, grade } : m)))
    if (dbReady) updateMemberDb(id, { grade })
  }

  // ── 회원 수동 추가 ──
  const setD = (key) => (e) => setDraft((d) => ({ ...d, [key]: e.target.value }))

  const addMember = async (e) => {
    e.preventDefault()
    const email = draft.email.trim()
    if (members.some((m) => m.email === email)) {
      window.alert('이미 등록된 이메일입니다.')
      return
    }
    const newMember = {
      id: Math.max(0, ...members.map((m) => m.id)) + 1,
      name: draft.name.trim(),
      email,
      phone: draft.phone.trim() || '-',
      hospital: draft.hospital.trim() || '-',
      specialty: draft.specialty.trim() || '-',
      grade: draft.grade,
      joinedAt: new Date().toISOString().slice(0, 10),
      status: 'active',
    }

    // 실제 로그인 계정 생성 — 비밀번호 미입력 시 기본 비밀번호 사용
    const password = draft.password.trim()
    setBusy(true)
    const account = await createLoginAccount({ ...newMember, password })
    // DB 저장 — 가입 트리거가 먼저 넣은 행이 있으면 병합 (병원/진료과목 등 보강)
    let savedMember = null
    if (dbReady) {
      const res = await upsertMember(newMember)
      if (res.ok) savedMember = res.member
    }
    setBusy(false)
    if (account.ok) {
      setNotice({
        type: 'ok',
        text: `회원 등록 완료 — ${email} 계정이 생성되었습니다. 비밀번호는 ${
          password ? '입력하신 비밀번호' : `기본 비밀번호(${DEFAULT_PASSWORD})`
        }이며, 인증 메일 확인 후 로그인할 수 있습니다.`,
      })
    } else if (account.error === 'already-registered') {
      setNotice({
        type: 'warn',
        text: '회원 목록에 추가했습니다 — 이미 가입된 이메일이라 로그인 계정은 새로 만들지 않았습니다.',
      })
    } else if (account.error === 'not-configured') {
      setNotice({
        type: 'warn',
        text: '회원 목록에 추가했습니다 — 인증 서버 미연결로 로그인 계정은 생성되지 않았습니다.',
      })
    } else {
      setNotice({
        type: 'warn',
        text: `회원 목록에 추가했습니다 — 로그인 계정 생성 실패: ${account.error}`,
      })
    }

    setMembers((ms) => [savedMember || newMember, ...ms])
    // 새 회원이 바로 보이도록 검색/필터 초기화 후 첫 페이지로
    setQueryInput('')
    setQ('')
    setFilter('all')
    setGradeFilter('전체')
    setPage(1)
    setDraft(EMPTY_DRAFT)
    setAdding(false)
  }

  // 체크박스 선택 / 등급 일괄 변경
  const filteredIds = filtered.map((m) => m.id)
  const allSelected = filteredIds.length > 0 && filteredIds.every((id) => selected.has(id))
  const someSelected = filteredIds.some((id) => selected.has(id))

  const toggleOne = (id) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (allSelected) filteredIds.forEach((id) => next.delete(id))
      else filteredIds.forEach((id) => next.add(id))
      return next
    })
  }

  const applyBulkGrade = () => {
    setMembers((ms) => ms.map((m) => (selected.has(m.id) ? { ...m, grade: bulkGrade } : m)))
    if (dbReady) [...selected].forEach((id) => updateMemberDb(id, { grade: bulkGrade }))
    setSelected(new Set())
  }

  const handleSearch = (e) => {
    e.preventDefault()
    setQ(queryInput.trim())
  }

  // 상태 필터 토글: 같은 버튼 다시 누르면 해제되어 전체 표시
  const toggleFilter = (key) => setFilter((f) => (f === key ? 'all' : key))

  // 상세 화면에서 저장한 회원 정보 반영
  const saveDetail = (id, patch) => {
    setMembers((ms) => ms.map((m) => (m.id === id ? { ...m, ...patch } : m)))
    if (dbReady) updateMemberDb(id, patch)
  }

  const detailMember = detailId != null ? members.find((m) => m.id === detailId) : null
  if (detailMember) {
    return (
      <MemberDetail member={detailMember} onBack={() => setDetailId(null)} onSave={saveDetail} />
    )
  }

  return (
    <>
      <div className="admin-head">
        <div>
          <h1>회원관리</h1>
          <p>가입 회원을 조회하고 상태를 관리합니다.</p>
        </div>
        <button
          className="btn btn--primary admin-head__action"
          onClick={() => setAdding((a) => !a)}
        >
          {adding ? '추가 취소' : '+ 회원 추가'}
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
        <form className="admin-add" onSubmit={addMember}>
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
                placeholder="user@example.com"
                value={draft.email}
                onChange={setD('email')}
              />
            </label>
            <label className="admin-add__field">
              <span>연락처</span>
              <input
                type="tel"
                inputMode="numeric"
                placeholder="010-0000-0000"
                value={draft.phone}
                onChange={(e) => setDraft((d) => ({ ...d, phone: formatPhone(e.target.value) }))}
              />
            </label>
            <label className="admin-add__field">
              <span>병원명</span>
              <input
                type="text"
                placeholder="OO의원"
                value={draft.hospital}
                onChange={setD('hospital')}
              />
            </label>
            <label className="admin-add__field">
              <span>전공과목</span>
              <input
                type="text"
                placeholder="내과"
                value={draft.specialty}
                onChange={setD('specialty')}
              />
            </label>
            <label className="admin-add__field">
              <span>회원유형</span>
              <select value={draft.grade} onChange={setD('grade')}>
                {GRADES.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </label>
            <label className="admin-add__field">
              <span>비밀번호</span>
              <input
                type="password"
                minLength={6}
                autoComplete="new-password"
                placeholder={`미입력 시 ${DEFAULT_PASSWORD}`}
                value={draft.password}
                onChange={setD('password')}
              />
            </label>
          </div>
          <div className="admin-add__actions">
            <button type="submit" className="btn btn--primary" disabled={busy}>
              {busy ? '등록 중...' : '회원 추가'}
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
            등록 시 로그인 계정이 함께 생성됩니다 — 기본 비밀번호 {DEFAULT_PASSWORD} · 인증 메일
            발송
          </p>
        </form>
      )}

      <div className="admin-stats">
        <div className="admin-stat">
          <b>{members.length}</b>
          <span>전체 회원</span>
        </div>
        <div className="admin-stat">
          <b>{activeCount}</b>
          <span>활성 회원</span>
        </div>
        <div className="admin-stat">
          <b>{suspendedCount}</b>
          <span>정지 회원</span>
        </div>
      </div>

      <div className="admin-toolbar">
        <form className="admin-search-form" onSubmit={handleSearch}>
          <input
            className="admin-search"
            type="text"
            placeholder="이름 · 이메일 · 병원명 검색"
            value={queryInput}
            onChange={(e) => {
              const v = e.target.value
              setQueryInput(v)
              if (v === '') setQ('')
            }}
          />
          <button type="submit" className="admin-search-btn">
            검색
          </button>
        </form>
        <div className="admin-filter">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              className={
                [f.key === 'suspended' ? 'danger' : '', filter === f.key ? 'is-active' : '']
                  .filter(Boolean)
                  .join(' ') || undefined
              }
              onClick={() => toggleFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <select
          className="admin-grade-filter"
          value={gradeFilter}
          onChange={(e) => setGradeFilter(e.target.value)}
          aria-label="등급 필터"
        >
          <option value="전체">전체 등급</option>
          {GRADES.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </div>

      {selected.size > 0 && (
        <div className="admin-bulk">
          <span className="admin-bulk__count">{selected.size}명 선택됨</span>
          <div className="admin-bulk__actions">
            <span>등급을</span>
            <select
              className="admin-grade-filter"
              value={bulkGrade}
              onChange={(e) => setBulkGrade(e.target.value)}
              aria-label="일괄 변경 등급"
            >
              {GRADES.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
            <button className="btn btn--primary admin-bulk__apply" onClick={applyBulkGrade}>
              일괄 변경
            </button>
          </div>
        </div>
      )}

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th className="admin-check-col">
                <input
                  type="checkbox"
                  className="admin-checkbox"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected && !allSelected
                  }}
                  onChange={toggleAll}
                  aria-label="전체 선택"
                />
              </th>
              <th>이름</th>
              <th>이메일</th>
              <th>연락처</th>
              <th>병원 / 전공과목</th>
              <th>등급</th>
              <th>가입일</th>
              <th>상태</th>
              <th>관리</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((m) => (
              <tr
                key={m.id}
                className={`admin-row-clickable ${selected.has(m.id) ? 'is-selected' : ''}`}
                onClick={(e) => {
                  // 체크박스·등급 선택·관리 버튼 클릭은 상세 진입에서 제외
                  if (e.target.closest('button, select, input, a')) return
                  setDetailId(m.id)
                }}
              >
                <td className="admin-check-col">
                  <input
                    type="checkbox"
                    className="admin-checkbox"
                    checked={selected.has(m.id)}
                    onChange={() => toggleOne(m.id)}
                    aria-label={`${m.name} 선택`}
                  />
                </td>
                <td>
                  <span className="m-name">{m.name}</span>
                </td>
                <td>{m.email}</td>
                <td>{m.phone}</td>
                <td>
                  {m.hospital} <span style={{ color: 'var(--ink-300)' }}>· {m.specialty}</span>
                </td>
                <td>
                  <select
                    className={`grade-select grade--${GRADE_CLASS[m.grade]}`}
                    value={m.grade}
                    onChange={(e) => changeGrade(m.id, e.target.value)}
                    aria-label={`${m.name} 등급`}
                  >
                    {GRADES.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </td>
                <td>{formatDate(m.joinedAt)}</td>
                <td>
                  <span className={`badge badge--${m.status}`}>
                    {m.status === 'active' ? '활성' : '정지'}
                  </span>
                </td>
                <td>
                  <div className="admin-actions">
                    <button
                      className={m.status === 'active' ? undefined : 'activate'}
                      onClick={() => toggleStatus(m.id)}
                    >
                      {m.status === 'active' ? '정지' : '활성'}
                    </button>
                    <button className="danger" onClick={() => removeMember(m.id)}>
                      삭제
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="admin-empty">조건에 맞는 회원이 없습니다.</div>}
      </div>

      {totalPages > 1 && (
        <nav className="admin-pagination" aria-label="페이지">
          <button disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>
            이전
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              className={n === currentPage ? 'is-active' : undefined}
              onClick={() => setPage(n)}
            >
              {n}
            </button>
          ))}
          <button disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)}>
            다음
          </button>
        </nav>
      )}
    </>
  )
}
