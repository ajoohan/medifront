import { PAINS } from '../data'

export default function PainPoints() {
  return (
    <section className="section section--soft">
      <div className="container">
        <div className="section-head center reveal">
          <span className="eyebrow">WHY MEDIFRONT</span>
          <h2>
            혹시, 이런 고민을 하고 계신가요?
          </h2>
          <p>많은 원장님들이 마케팅에 비용을 쓰면서도 같은 벽에 부딪힙니다.</p>
        </div>

        <div className="pain__grid">
          {PAINS.map((p) => (
            <article className="pain-card reveal" key={p.q}>
              <div className="pain-card__q">{p.q}</div>
              <h4>{p.title}</h4>
              <p>{p.desc}</p>
            </article>
          ))}
        </div>

        <div className="pain__answer reveal">
          <h3>성공한 병원일수록, 원장님은 마케팅에 손대지 않습니다</h3>
          <p>
            진료는 원장님이, 성장은 메디프론트가. 전담팀과 데이터 시스템이
            병원의 마케팅과 경영을 대신 책임집니다.
          </p>
        </div>
      </div>
    </section>
  )
}
