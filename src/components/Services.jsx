import { SERVICES } from '../data'
import { IconMegaphone, IconChart, IconBuilding, IconCpu } from './Icons'

const ICONS = {
  megaphone: IconMegaphone,
  chart: IconChart,
  building: IconBuilding,
  cpu: IconCpu,
}

export default function Services() {
  return (
    <section className="section" id="services">
      <div className="container">
        <div className="section-head center reveal">
          <span className="eyebrow">SERVICES</span>
          <h2>
            병원 성장에 필요한 모든 것,
            <br />
            <span className="accent">하나의 파트너</span>로 끝냅니다
          </h2>
          <p>
            흩어진 업체를 관리할 필요 없이, 마케팅·경영·개원·AI까지
            메디프론트 전담팀이 통합적으로 설계하고 운영합니다.
          </p>
        </div>

        <div className="services__grid">
          {SERVICES.map((s, i) => {
            const Icon = ICONS[s.icon]
            return (
              <article className="service-card reveal" key={s.title}>
                <span className="service-card__num">0{i + 1}</span>
                <div className="service-card__icon">
                  <Icon width={28} height={28} />
                </div>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
                <div className="service-card__tags">
                  {s.tags.map((t) => (
                    <span key={t}>{t}</span>
                  ))}
                </div>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
