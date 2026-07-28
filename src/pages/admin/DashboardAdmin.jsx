import { fetchMembers } from '../../lib/membersDb'
import { fetchArticlesDb } from '../../lib/articlesDb'
import { fetchRequests } from '../../lib/requestsDb'
import { fetchAllInquiries } from '../../lib/inquiriesDb'
import { fetchConsultsDb } from '../../lib/consultsDb'
import { fetchOperatorsDb } from '../../lib/operatorsDb'
import useAdminData from '../../hooks/useAdminData'
import { CK } from '../../lib/adminCache'
import { SkeletonKpis, SkeletonCards, LoadingRegion } from '../../components/admin/Skeleton'

// 대시보드가 쓰는 여섯 목록을 한 번에 받아온다
const loadAll = () =>
  Promise.all([
    fetchMembers(),
    fetchArticlesDb(),
    fetchRequests(),
    fetchAllInquiries(),
    fetchConsultsDb(),
    fetchOperatorsDb(),
  ]).then(([members, articles, requests, inquiries, consults, operators]) => ({
    members: members || [],
    articles: articles || [],
    requests: requests || [],
    inquiries: inquiries || [],
    consults: consults || [],
    operators: operators || [],
  }))

function formatDateTime(iso) {
  if (!iso) return '-'
  const d = new Date(iso)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getMonth() + 1}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

// 관리자 대시보드 — 전 영역 요약 (회원·상담·문의·콘텐츠·운영자)
export default function DashboardAdmin({ onGo }) {
  const { data, status, fresh } = useAdminData(CK.dashboard, loadAll)

  const head = (
    <div className="admin-head">
      <div>
        <h1>대시보드</h1>
        <p>메디프론트 운영 현황을 한눈에 확인합니다.</p>
      </div>
    </div>
  )

  // 최초 로드 — 실제 화면과 같은 자리에 스켈레톤을 깔아 레이아웃이 흔들리지 않게 한다
  if (status === 'loading') {
    return (
      <>
        {head}
        <LoadingRegion label="운영 현황 불러오는 중">
          <SkeletonKpis />
          <div className="dash-grid" style={{ marginTop: 14 }}>
            <SkeletonCards count={1} lines={5} />
            <SkeletonCards count={1} lines={5} />
          </div>
        </LoadingRegion>
      </>
    )
  }

  const { members, articles, requests, inquiries, consults, operators } = data
  const gradeCount = (g) => members.filter((m) => m.grade === g).length
  const newRequests = requests.filter((r) => r.status === 'new').length
  const openInquiries = inquiries.filter((q) => q.status !== 'answered').length
  const visibleArticles = articles.filter((a) => a.status !== 'hidden').length

  // 핵심 지표 카드 (클릭 시 해당 메뉴로 이동)
  const kpis = [
    {
      label: '전체 회원',
      value: members.length,
      sub: `의사 ${gradeCount('의사')} · 병원 ${gradeCount('병원')} · 일반 ${gradeCount('일반')}`,
      go: 'members',
    },
    {
      label: '신규 상담 신청',
      value: newRequests,
      sub: `전체 ${requests.length}건`,
      go: 'consult-meeting',
      accent: newRequests > 0,
    },
    {
      label: '미답변 1:1 문의',
      value: openInquiries,
      sub: `전체 ${inquiries.length}건`,
      go: 'consult-direct',
      accent: openInquiries > 0,
    },
    {
      label: '매거진 게시물',
      value: visibleArticles,
      sub: `노출 ${visibleArticles} / 전체 ${articles.length}`,
      go: 'magazine',
    },
  ]

  return (
    <>
      {head}
      {/* 캐시를 먼저 보여주고 최신값을 받는 중 */}
      {!fresh && <div className="admin-refresh" aria-label="최신 정보를 받는 중" />}

      {/* 핵심 지표 */}
      <div className="dash-kpis admin-fade">
        {kpis.map((k) => (
          <button
            key={k.label}
            className={`dash-kpi ${k.accent ? 'dash-kpi--accent' : ''}`}
            onClick={() => onGo?.(k.go)}
          >
            <span className="dash-kpi__label">{k.label}</span>
            <b className="dash-kpi__value">{k.value}</b>
            <span className="dash-kpi__sub">{k.sub}</span>
          </button>
        ))}
      </div>

      {/* 최근 상담 신청 · 최근 1:1 문의 */}
      <div className="dash-grid admin-fade">
        <section className="dash-panel">
          <div className="dash-panel__head">
            <h3>최근 상담 신청</h3>
            <button className="dash-panel__more" onClick={() => onGo?.('consult-meeting')}>
              전체 보기
            </button>
          </div>
          {requests.length === 0 ? (
            <div className="dash-empty">접수된 상담 신청이 없습니다.</div>
          ) : (
            <ul className="dash-list">
              {requests.slice(0, 5).map((r) => (
                <li key={r.id}>
                  <div className="dash-list__main">
                    <b>{r.name}</b>
                    <span>
                      {r.specialty} · {r.openingRegion}
                    </span>
                  </div>
                  <div className="dash-list__side">
                    <span
                      className={`iq-badge ${r.status === 'done' ? 'iq-badge--answered' : 'iq-badge--open'}`}
                    >
                      {r.status === 'done' ? '처리완료' : '신규'}
                    </span>
                    <span className="dash-list__date">{formatDateTime(r.createdAt)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="dash-panel">
          <div className="dash-panel__head">
            <h3>최근 1:1 문의</h3>
            <button className="dash-panel__more" onClick={() => onGo?.('consult-direct')}>
              전체 보기
            </button>
          </div>
          {inquiries.length === 0 ? (
            <div className="dash-empty">접수된 1:1 문의가 없습니다.</div>
          ) : (
            <ul className="dash-list">
              {inquiries.slice(0, 5).map((q) => (
                <li key={q.id}>
                  <div className="dash-list__main">
                    <b>{q.title}</b>
                    <span>{q.name}</span>
                  </div>
                  <div className="dash-list__side">
                    <span
                      className={`iq-badge ${q.status === 'answered' ? 'iq-badge--answered' : 'iq-badge--open'}`}
                    >
                      {q.status === 'answered' ? '답변완료' : '답변대기'}
                    </span>
                    <span className="dash-list__date">{formatDateTime(q.createdAt)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* 콘텐츠·운영 요약 */}
      <div className="dash-mini admin-fade">
        <button className="dash-mini__item" onClick={() => onGo?.('consult-meeting')}>
          <span>대면 상담 기록</span>
          <b>{consults.length}</b>
        </button>
        <button className="dash-mini__item" onClick={() => onGo?.('magazine')}>
          <span>매거진 게시물</span>
          <b>{articles.length}</b>
        </button>
        <button className="dash-mini__item" onClick={() => onGo?.('settings')}>
          <span>운영자</span>
          <b>{operators.length}</b>
        </button>
      </div>
    </>
  )
}
