import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { MAGAZINE_FILTERS } from '../data'
import { IconArrowRight } from './Icons'
import { loadArticles } from '../lib/magazineStore'
import { fetchArticlesDb } from '../lib/articlesDb'

// 카테고리별 썸네일 그라디언트 (브랜드 청록 계열) — 첨부 이미지가 없을 때 사용
const THUMB = {
  매물: 'linear-gradient(135deg, #0f524b, #23c3b1)',
  운영: 'linear-gradient(135deg, #072e2b, #10a696)',
  마케팅: 'linear-gradient(135deg, #0b3f3a, #2ed9c6)',
  기타: 'linear-gradient(135deg, #04211f, #1eb5a6)',
}
const FALLBACK_THUMB = 'linear-gradient(135deg, #0b3f3a, #1eb5a6)'

// 글의 첫 첨부 이미지를 썸네일로, 없으면 그라디언트
function thumbStyle(a) {
  if (a.thumbnail) {
    return {
      backgroundImage: `url(${a.thumbnail})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    }
  }
  return { background: THUMB[a.category] || FALLBACK_THUMB }
}

function formatDate(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${y}. ${Number(m)}. ${Number(d)}.`
}

export default function Magazine() {
  const [active, setActive] = useState('전체')
  // 관리자에서 등록한 글을 DB에서 로드 (미연결 시 브라우저 저장 폴백, 숨김 글 제외)
  const [articles, setArticles] = useState([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    fetchArticlesDb().then((list) => {
      setArticles(list || loadArticles())
      setLoaded(true)
    })
  }, [])

  const visible = articles.filter((a) => a.status !== 'hidden')
  const items = active === '전체' ? visible : visible.filter((a) => a.category === active)
  const hasArticles = visible.length > 0

  return (
    <section className="section">
      <div className="container">
        {/* 게시물이 하나도 없으면 카테고리 필터를 숨긴다 (선택할 대상이 없으므로) */}
        {hasArticles && (
          <div className="magazine__filter reveal">
            {MAGAZINE_FILTERS.map((c) => (
              <button
                key={c}
                className={`mag-chip ${active === c ? 'is-active' : ''}`}
                onClick={() => setActive(c)}
              >
                {c}
              </button>
            ))}
          </div>
        )}

        {loaded && !hasArticles && (
          <div className="mag-empty reveal">
            <span className="mag-empty__icon" aria-hidden="true">
              <svg
                width="30"
                height="30"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H15l5 5v9.5A1.5 1.5 0 0 1 18.5 20h-13A1.5 1.5 0 0 1 4 18.5Z" />
                <path d="M15 4v5h5" />
                <path d="M8.5 13h7M8.5 16.5h4.5" />
              </svg>
            </span>
            <h3>아직 등록된 매거진이 없습니다</h3>
            <p>
              병원 마케팅·경영·개원 인사이트를 준비하고 있습니다.
              <br />첫 번째 글로 곧 찾아뵙겠습니다.
            </p>
          </div>
        )}
        {loaded && hasArticles && items.length === 0 && (
          <div className="mag-empty mag-empty--sm reveal">
            <h3>이 카테고리에 등록된 글이 없습니다</h3>
            <p>다른 카테고리를 선택해 보세요.</p>
          </div>
        )}

        <div className="magazine__grid">
          {items.map((a) => (
            <Link className="mag-card" to={`/magazine/${a.id}`} key={a.id ?? a.title}>
              <div className="mag-card__thumb" style={thumbStyle(a)}>
                {a.category && <span className="mag-card__cat">{a.category}</span>}
              </div>
              <div className="mag-card__body">
                <h3>{a.title}</h3>
                <p>{a.excerpt}</p>
                <div className="mag-card__meta">
                  <span>
                    {[formatDate(a.date), a.read ? `${a.read} 읽기` : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                  <span className="mag-card__more">
                    읽어보기 <IconArrowRight width={14} height={14} />
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
