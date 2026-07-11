import { PROCESS } from '../data'

export default function Process() {
  return (
    <section className="section section--navy" id="process">
      <div className="container">
        <div className="section-head center reveal">
          <span className="eyebrow">HOW WE WORK</span>
          <h2>
            검증된 <span className="accent">개원∙성장 프로세스</span>
          </h2>
          <p>
            감이 아닌 데이터로, 즉흥이 아닌 시스템으로,
            <br />
            병∙의원을 개원∙성장시킵니다.
          </p>
        </div>

        <div className="process__grid">
          {PROCESS.map((step, i) => (
            <article className="process-step reveal" key={step.title}>
              <div className="process-step__num">{i + 1}</div>
              <h4>{step.title}</h4>
              <p>{step.desc}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
