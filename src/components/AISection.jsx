import { AI_FEATURES } from '../data'
import { IconBuilding, IconMegaphone, IconPen, IconSearch, IconSpark } from './Icons'

const ICONS = {
  search: IconSearch,
  pen: IconPen,
  building: IconBuilding,
  megaphone: IconMegaphone,
}

export default function AISection() {
  return (
    <section className="section section--gradient">
      <div className="container ai__inner">
        <div className="reveal">
          <span className="eyebrow">AI TECHNOLOGY</span>
          <h2 style={{ fontSize: 'clamp(1.7rem, 4vw, 2.5rem)' }}>
            컨설팅을 <span className="accent">쓰느냐</span>가 아니라,
            <br />
            <span className="accent">어떤 컨설팅을 쓰느냐</span>의 차이
          </h2>
          <p style={{ marginTop: 18, color: 'var(--blue-300)', fontSize: '1.08rem' }}>
            메디프론트는 병∙의원 개원∙마케팅에 특화된 노하우를 갖추고 있습니다. 입지분석부터
            개원절차, 마케팅까지 성과로 증명해보이겠습니다.
          </p>
          <div
            style={{
              marginTop: 26,
              display: 'flex',
              gap: 10,
              alignItems: 'center',
              color: 'var(--teal-400)',
              fontWeight: 700,
            }}
          >
            <IconSpark width={20} height={20} />
            사람의 전문성 + AI의 속도 = 압도적인 결과
          </div>
        </div>

        <div className="ai__features">
          {AI_FEATURES.map((f) => {
            const Icon = ICONS[f.icon]
            return (
              <article className="ai-feature reveal" key={f.title}>
                <div className="ico">
                  <Icon width={26} height={26} />
                </div>
                <b>{f.title}</b>
                <span>{f.desc}</span>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
