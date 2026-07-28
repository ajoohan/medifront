// 관리자 화면 로딩 자리표시자 —
// 데이터가 도착하기 전 실제 콘텐츠와 같은 크기의 회색 블록을 보여준다.
// 높이가 미리 잡혀 있어 데이터가 채워질 때 화면이 튀지 않는다.

// 글자 한 줄
export function SkeletonLine({ w = '100%', h = 14 }) {
  return <span className="sk sk--line" style={{ width: w, height: h }} />
}

// 표 — 관리자 목록 화면 공용
export function SkeletonTable({ rows = 6, cols = 5 }) {
  return (
    <div className="sk-table" aria-hidden="true">
      <div className="sk-table__head">
        {Array.from({ length: cols }, (_, i) => (
          <SkeletonLine key={i} w="60%" h={12} />
        ))}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div className="sk-table__row" key={r}>
          {Array.from({ length: cols }, (_, c) => (
            <SkeletonLine key={c} w={c === 0 ? '70%' : '45%'} />
          ))}
        </div>
      ))}
    </div>
  )
}

// 카드 목록 (매거진·컨설팅 자료·성과 등)
export function SkeletonCards({ count = 3, lines = 2 }) {
  return (
    <div className="sk-cards" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div className="sk-card" key={i}>
          <SkeletonLine w="30%" h={11} />
          <SkeletonLine w="72%" h={17} />
          {Array.from({ length: lines }, (_, j) => (
            <SkeletonLine key={j} w={j === lines - 1 ? '55%' : '92%'} h={12} />
          ))}
        </div>
      ))}
    </div>
  )
}

// 대시보드 지표 카드
export function SkeletonKpis({ count = 4 }) {
  return (
    <div className="dash-kpis" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div className="dash-kpi dash-kpi--sk" key={i}>
          <SkeletonLine w="55%" h={12} />
          <SkeletonLine w="34%" h={28} />
          <SkeletonLine w="80%" h={11} />
        </div>
      ))}
    </div>
  )
}

// 로딩 중임을 스크린리더에도 알린다 (스켈레톤은 aria-hidden)
export function LoadingRegion({ label = '불러오는 중', children }) {
  return (
    <div className="sk-region" role="status" aria-busy="true" aria-label={label}>
      {children}
    </div>
  )
}
