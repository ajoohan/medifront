import { useState } from 'react'
import { MAGAZINE, MAGAZINE_CATEGORIES } from '../data'
import { IconArrowRight } from './Icons'

// 카테고리별 썸네일 그라디언트 (브랜드 청록 계열)
const THUMB = {
  마케팅: 'linear-gradient(135deg, #0f524b, #23c3b1)',
  경영: 'linear-gradient(135deg, #072e2b, #10a696)',
  개원: 'linear-gradient(135deg, #0b3f3a, #2ed9c6)',
  'AI·트렌드': 'linear-gradient(135deg, #04211f, #1eb5a6)',
}

function formatDate(iso) {
  const [y, m, d] = iso.split('-')
  return `${y}. ${Number(m)}. ${Number(d)}.`
}

export default function Magazine() {
  const [active, setActive] = useState('전체')
  const items = active === '전체' ? MAGAZINE : MAGAZINE.filter((a) => a.category === active)

  return (
    <section className="section">
      <div className="container">
        <div className="magazine__filter reveal">
          {MAGAZINE_CATEGORIES.map((c) => (
            <button
              key={c}
              className={`mag-chip ${active === c ? 'is-active' : ''}`}
              onClick={() => setActive(c)}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="magazine__grid">
          {items.map((a) => (
            <article className="mag-card" key={a.title}>
              <div className="mag-card__thumb" style={{ background: THUMB[a.category] }}>
                <span className="mag-card__cat">{a.category}</span>
              </div>
              <div className="mag-card__body">
                <h3>{a.title}</h3>
                <p>{a.excerpt}</p>
                <div className="mag-card__meta">
                  <span>
                    {formatDate(a.date)} · {a.read} 읽기
                  </span>
                  <span className="mag-card__more">
                    읽어보기 <IconArrowRight width={14} height={14} />
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>

        <p className="magazine__note reveal">* 매거진 콘텐츠는 준비 중인 샘플입니다.</p>
      </div>
    </section>
  )
}
