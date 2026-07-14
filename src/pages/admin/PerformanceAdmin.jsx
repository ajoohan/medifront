import { useEffect, useState } from 'react'
import { openingLabel } from '../../data'
import { fetchPerformances, insertPerformance, deletePerformance } from '../../lib/performancesDb'

// 개원시기 선택지 — 2020년부터 올해까지
const YEARS = (() => {
  const now = new Date().getFullYear()
  const list = []
  for (let y = now; y >= 2020; y--) list.push(y)
  return list
})()

const EMPTY_DRAFT = { hospital: '', size: '', openingYear: String(new Date().getFullYear()) }

// 콘텐츠 관리 > 성과 관리 — 홈페이지 '성과' 섹션 게시물 관리
export default function PerformanceAdmin() {
  const [items, setItems] = useState([])
  const [available, setAvailable] = useState(true) // performances 테이블 사용 가능 여부
  const [checked, setChecked] = useState(false)
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState(EMPTY_DRAFT)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    fetchPerformances().then((list) => {
      if (list === null) setAvailable(false)
      else setItems(list)
      setChecked(true)
    })
  }, [])

  const setD = (key) => (e) => setDraft((d) => ({ ...d, [key]: e.target.value }))

  const add = async (e) => {
    e.preventDefault()
    setBusy(true)
    const res = await insertPerformance({
      hospital: draft.hospital.trim(),
      size: draft.size.trim(),
      openingYear: Number(draft.openingYear),
    })
    setBusy(false)
    if (res.ok) {
      setItems((ls) => [...ls, res.performance])
      setDraft(EMPTY_DRAFT)
      setAdding(false)
    } else {
      window.alert(`성과 저장 실패: ${res.error}`)
    }
  }

  const remove = (p) => {
    if (!window.confirm(`'${p.hospital}' 성과를 삭제하시겠습니까?`)) return
    setItems((ls) => ls.filter((it) => it.id !== p.id))
    deletePerformance(p.id)
  }

  return (
    <>
      <div className="admin-head">
        <div>
          <h1>성과 관리</h1>
          <p>홈페이지 성과 섹션에 노출되는 병원 성과를 관리합니다.</p>
        </div>
        {available && (
          <button
            className="btn btn--primary admin-head__action"
            onClick={() => setAdding((a) => !a)}
          >
            {adding ? '추가 취소' : '+ 성과 추가'}
          </button>
        )}
      </div>

      {checked && !available && (
        <div className="admin-notice admin-notice--warn">
          성과 데이터 DB(performances)에 연결되지 않았습니다. AWS 백엔드 배포와 환경변수
          설정(docs/aws-backend.md)이 완료되면 홈페이지 성과가 실데이터로 전환됩니다.
        </div>
      )}

      {adding && (
        <form className="admin-add" onSubmit={add}>
          <div className="admin-add__grid">
            <label className="admin-add__field">
              <span>
                병원명 <b className="req">*</b>
              </span>
              <input
                type="text"
                required
                placeholder="강동*****의원"
                value={draft.hospital}
                onChange={setD('hospital')}
              />
            </label>
            <label className="admin-add__field">
              <span>
                평수 <b className="req">*</b>
              </span>
              <input
                type="text"
                required
                placeholder="약380"
                value={draft.size}
                onChange={setD('size')}
              />
            </label>
            <label className="admin-add__field">
              <span>개원시기</span>
              <select value={draft.openingYear} onChange={setD('openingYear')}>
                {YEARS.map((y) => (
                  <option key={y} value={y}>
                    {y}년
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="admin-add__actions">
            <button type="submit" className="btn btn--primary" disabled={busy}>
              {busy ? '등록 중...' : '성과 추가'}
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
            평수는 자유 입력(예: 약380 · 380), 홈페이지에는 뒤에 &lsquo;평&rsquo;이 붙어 표시됩니다.
          </p>
        </form>
      )}

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>병원명</th>
              <th>평수</th>
              <th>개원시기</th>
              <th>홈페이지 표기</th>
              <th>관리</th>
            </tr>
          </thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.id}>
                <td>
                  <span className="m-name">{p.hospital}</span>
                </td>
                <td>{p.size}평</td>
                <td>{p.openingYear}년</td>
                <td>{openingLabel(p.openingYear)}</td>
                <td>
                  <div className="admin-actions">
                    <button className="danger" onClick={() => remove(p)}>
                      삭제
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {available && items.length === 0 && (
          <div className="admin-empty">등록된 성과가 없습니다.</div>
        )}
      </div>
    </>
  )
}
