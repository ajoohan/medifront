import { useState } from 'react'
import { CONSULTING_DOCS, byNewest } from '../../lib/consultingDocs'
import { fetchDocFlags, setDocHidden, invalidateDocFlags } from '../../lib/consultingDocsDb'
import useAdminData from '../../hooks/useAdminData'
import { CK } from '../../lib/adminCache'
import { SkeletonCards, LoadingRegion } from '../../components/admin/Skeleton'

// 콘텐츠 관리 > 컨설팅 자료 — 홈페이지 '컨설팅' 메뉴에 노출할 자료를 켜고 끈다.
// 자료 본문(HTML 덱)은 정적 파일이라 여기서 수정하지 않는다. 노출 여부만 다룬다.
export default function ConsultingDocsAdmin() {
  const { data, status, fresh, setData } = useAdminData(CK.consultingDocs, fetchDocFlags)
  const flags = data || {} // doc_id -> { rowId, hidden }
  const available = data !== null
  const checked = status === 'ready'
  const setFlags = (next) => setData((cur) => (typeof next === 'function' ? next(cur || {}) : next))
  const [busy, setBusy] = useState(null) // 저장 중인 doc_id

  const toggle = async (doc) => {
    const cur = flags[doc.id]
    const next = !cur?.hidden
    setBusy(doc.id)
    // 낙관적 반영 — 실패하면 되돌린다
    setFlags((f) => ({ ...f, [doc.id]: { ...f[doc.id], hidden: next } }))
    const res = await setDocHidden(doc.id, next, cur?.rowId)
    setBusy(null)
    if (res.error) {
      setFlags((f) => ({ ...f, [doc.id]: { ...f[doc.id], hidden: !next } }))
      window.alert(`노출 설정 저장 실패: ${res.error}`)
      return
    }
    setFlags((f) => ({ ...f, [doc.id]: { rowId: res.rowId, hidden: next } }))
    invalidateDocFlags() // 헤더 배지·목록이 다음 조회 때 새 값을 읽도록
  }

  const shown = CONSULTING_DOCS.filter((d) => !flags[d.id]?.hidden).length
  // 관리자 목록은 등록일 최신순 그대로 — 켜고 끈 자료가 자리를 옮기면 조작하기 어렵다
  const ordered = [...CONSULTING_DOCS].sort(byNewest)

  return (
    <>
      <div className="admin-head">
        <div>
          <h1>컨설팅 자료</h1>
          <p>
            홈페이지 상단 &lsquo;컨설팅&rsquo; 메뉴에 노출할 자료를 관리합니다. 목록은 최신 자료가
            위에 옵니다.
          </p>
        </div>
        <span className="admin-head__meta">
          노출 {shown} / 전체 {CONSULTING_DOCS.length}
        </span>
      </div>

      {checked && !available && (
        <div className="admin-notice admin-notice--warn">
          컨설팅 자료 설정 DB(consulting_docs)에 연결되지 않았습니다. 백엔드 배포가 끝나면 노출
          설정을 저장할 수 있습니다. 그전까지는 자료 2건이 모두 노출됩니다.
        </div>
      )}

      {checked && !fresh && <div className="admin-refresh" aria-label="최신 설정을 받는 중" />}

      {!checked ? (
        <LoadingRegion label="컨설팅 자료 불러오는 중">
          <SkeletonCards count={CONSULTING_DOCS.length} lines={2} />
        </LoadingRegion>
      ) : (
        <ul className="doc-admin-list admin-fade">
          {ordered.map((d) => {
            const hidden = !!flags[d.id]?.hidden
            return (
              <li key={d.id} className={`doc-admin ${hidden ? 'is-hidden' : ''}`}>
                <div className="doc-admin__body">
                  <span className="doc-admin__kicker">{d.kicker}</span>
                  <h3>{d.title}</h3>
                  <p>{d.desc}</p>
                  <a
                    className="doc-admin__link"
                    href={d.file}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    자료 미리보기 ↗
                  </a>
                </div>

                <div className="doc-admin__control">
                  <span className={`doc-admin__state ${hidden ? 'off' : 'on'}`}>
                    {hidden ? '비노출' : '노출 중'}
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={!hidden}
                    aria-label={`${d.title} 노출`}
                    className={`switch ${hidden ? '' : 'is-on'}`}
                    disabled={!available || busy === d.id}
                    onClick={() => toggle(d)}
                  >
                    <span className="switch__knob" />
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}
