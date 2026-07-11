import { PAINS } from '../data'

export default function PainPoints() {
  return (
    <section className="section section--soft">
      <div className="container">
        <div className="section-head center reveal">
          <span className="eyebrow">WHY MEDIFRONT</span>
          <h2>혹시, 이런 고민을 하고 계신가요?</h2>
          <p>
            막상 개원을 하려니 입지부터 절차까지 막막합니다.
            <br />
            개원 후 운영이 잘 될지, 매출은 잘 나올지 걱정이 됩니다.
          </p>
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
          <h3>원장님은 진료에 집중하세요</h3>
          <p>
            진료는 원장님이, 개원절차와 성장은 메디프론트가, 전담팀과 시스템이 병∙의원의 마케팅을
            책임집니다.
          </p>
        </div>
      </div>
    </section>
  )
}
