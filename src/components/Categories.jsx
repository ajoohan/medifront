import { CATEGORIES, SPECIALTIES } from '../data'

export default function Categories() {
  return (
    <section className="section">
      <div className="container">
        <div className="section-head center reveal">
          <span className="eyebrow">BY SPECIALTY</span>
          <h2>
            <span className="accent">성과 데이터</span>
          </h2>
        </div>

        <div className="cat__grid">
          {CATEGORIES.map((c) => (
            <article className="cat-card reveal" key={c.name}>
              <div className="cat-card__name">
                {c.name}
                <span>{c.sub}</span>
              </div>
              <div className="cat-card__val">{c.val}</div>
            </article>
          ))}
        </div>

        <div
          className="reveal"
          style={{
            marginTop: 34,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 10,
            justifyContent: 'center',
          }}
        >
          {SPECIALTIES.map((s) => (
            <span
              key={s}
              style={{
                padding: '8px 16px',
                borderRadius: 999,
                background: 'var(--paper-soft)',
                border: '1px solid var(--line)',
                fontSize: '0.88rem',
                fontWeight: 600,
                color: 'var(--ink-700)',
              }}
            >
              {s}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}
