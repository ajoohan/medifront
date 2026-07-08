import { useMemo, useState } from 'react'
import { MOCK_MEMBERS } from '../../mock/members'

const FILTERS = [
  { key: 'all', label: '전체' },
  { key: 'active', label: '활성' },
  { key: 'suspended', label: '정지' },
]

const GRADES = ['일반', '의사', '원장']
const GRADE_CLASS = { 일반: 'general', 의사: 'doctor', 원장: 'director' }

function formatDate(iso) {
  const [y, m, d] = iso.split('-')
  return `${y}.${m}.${d}`
}

export default function MembersAdmin() {
  const [members, setMembers] = useState(MOCK_MEMBERS)
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('all')
  const [gradeFilter, setGradeFilter] = useState('전체')
  const [selected, setSelected] = useState(() => new Set())
  const [bulkGrade, setBulkGrade] = useState('일반')

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

  const activeCount = members.filter((m) => m.status === 'active').length
  const suspendedCount = members.length - activeCount

  const toggleStatus = (id) => {
    setMembers((ms) =>
      ms.map((m) =>
        m.id === id ? { ...m, status: m.status === 'active' ? 'suspended' : 'active' } : m,
      ),
    )
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
    }
  }

  const changeGrade = (id, grade) => {
    setMembers((ms) => ms.map((m) => (m.id === id ? { ...m, grade } : m)))
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
    setSelected(new Set())
  }

  return (
    <>
      <div className="admin-head">
        <div>
          <h1>회원관리</h1>
          <p>가입 회원을 조회하고 상태를 관리합니다.</p>
        </div>
      </div>

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
        <input
          className="admin-search"
          type="search"
          placeholder="이름 · 이메일 · 병원명 검색"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="admin-filter">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              className={filter === f.key ? 'is-active' : undefined}
              onClick={() => setFilter(f.key)}
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
              <th>병원 / 진료과목</th>
              <th>등급</th>
              <th>가입일</th>
              <th>상태</th>
              <th>관리</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((m) => (
              <tr key={m.id} className={selected.has(m.id) ? 'is-selected' : undefined}>
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
                    <button onClick={() => toggleStatus(m.id)}>
                      {m.status === 'active' ? '정지' : '활성화'}
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
    </>
  )
}
