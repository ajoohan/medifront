import { RESULTS } from '../data'

export default function Results() {
  return (
    <section className="section section--gradient" id="results">
      <div className="container">
        <div className="section-head center reveal">
          <span className="eyebrow">SUCCESS STORIES</span>
          <h2>
            숫자로 증명하는 <span className="accent">성장의 결과</span>
          </h2>
          <p>진료과목을 가리지 않고, 데이터로 관리한 병원은 다르게 성장합니다.</p>
        </div>

        <div className="results__grid">
          {RESULTS.map((r) => (
            <article className="result-card reveal" key={r.tag + r.who}>
              <span className="result-card__tag">{r.tag}</span>
              <div className="result-card__metric">
                {r.metric}
                <small>{r.unit}</small>
              </div>
              <p>{r.desc}</p>
              <div className="result-card__who">{r.who}</div>
            </article>
          ))}
        </div>

        <p
          className="reveal"
          style={{
            marginTop: 28,
            textAlign: 'center',
            fontSize: '0.82rem',
            color: 'rgba(130,226,213,0.7)',
          }}
        >
          * 위 성과는 이해를 돕기 위한 예시이며, 병원별 상황에 따라 결과는 달라질 수 있습니다.
        </p>
      </div>
    </section>
  )
}
