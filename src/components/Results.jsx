import { useState } from 'react'
import { RESULTS } from '../data'

const PAGE_SIZE = 6

export default function Results() {
  const [page, setPage] = useState(1)
  const totalPages = Math.max(1, Math.ceil(RESULTS.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const items = RESULTS.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  return (
    <section className="section section--gradient" id="results">
      <div className="container">
        <div className="section-head center reveal">
          <span className="eyebrow">SUCCESS STORIES</span>
          <h2>
            <span className="accent">폐업률 0%</span>가 증명하는 성공 개원의 결과
          </h2>
          <p>진료과목을 가리지 않고, 데이터로 관리한 병원은 다르게 성장합니다.</p>
        </div>

        {/* 사례 자리표시 박스 — 사례 이미지·내용 확정 시 교체 */}
        <div className="results__grid reveal">
          {items.map((_, i) => (
            <article className="placeholder-box" key={i} />
          ))}
        </div>

        <nav className="results__pagination" aria-label="사례 페이지">
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
      </div>
    </section>
  )
}
