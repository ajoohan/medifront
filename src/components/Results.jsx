import { useEffect, useState } from 'react'
import { RESULTS, openingLabel } from '../data'
import { fetchPerformances } from '../lib/performancesDb'

const PAGE_SIZE = 6

export default function Results() {
  const [items, setItems] = useState(RESULTS) // 초기값: 폴백(테이블 미생성 시)
  const [page, setPage] = useState(1)

  useEffect(() => {
    fetchPerformances().then((list) => {
      if (list) setItems(list)
    })
  }, [])

  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pageItems = items.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  return (
    <section className="section section--gradient" id="results">
      <div className="container">
        <div className="section-head center reveal">
          <span className="eyebrow">SUCCESS STORIES</span>
          <h2>
            <span className="accent">폐업률 0%</span>가 증명하는
            <br />
            성공 개원의 결과
          </h2>
          <p>메디프론트와 함께하는 병원은 다르게 성장합니다.</p>
        </div>

        <div className="results__grid reveal">
          {pageItems.map((r) => (
            <article className="result-card" key={r.id ?? r.hospital}>
              <span className="result-card__tag">{r.hospital}</span>
              <div className="result-card__metric">
                {r.size}
                <small>평</small>
              </div>
              <p>{openingLabel(r.openingYear)}</p>
            </article>
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
