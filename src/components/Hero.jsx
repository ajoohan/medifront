import { BRAND, HERO_STATS } from '../data'
import { IconArrowRight } from './Icons'

const bars = [
  { h: '32%', label: '' },
  { h: '46%', label: '' },
  { h: '58%', label: '' },
  { h: '74%', label: '' },
  { h: '100%', label: '4.7배' },
]

export default function Hero() {
  return (
    <section className="hero" id="top">
      <div className="hero__grid-bg" />
      <div className="container hero__inner">
        <div className="hero__copy">
          <span className="hero__badge">
            <span className="dot" />
            데이터와 AI로 증명하는 병원 성장
          </span>
          <h1>
            원장님의 든든한
            <br />
            <span className="grad">병원 컨설팅 파트너</span>
          </h1>
          <p className="hero__sub">
            마케팅 운영대행부터 경영 컨설팅, 개원 브랜딩, AI 데이터 솔루션까지.
            {BRAND.name}이 병원 성장의 모든 과정을 함께합니다.
          </p>

          <div className="hero__actions">
            <a href="#contact" className="btn btn--primary btn--lg">
              무료 정밀 진단 받기
              <IconArrowRight width={18} height={18} />
            </a>
            <a href="#services" className="btn btn--ghost btn--lg">
              서비스 살펴보기
            </a>
          </div>

          <div className="hero__trust">
            {HERO_STATS.map((s, i) => (
              <span key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
                {i > 0 && <span className="divider" />}
                <span>
                  <b style={{ color: '#fff' }}>{s.value}</b> · {s.label}
                </span>
              </span>
            ))}
          </div>
        </div>

        <div className="hero__card reveal">
          <h4>블로그 유입 성장 시뮬레이션</h4>
          <div className="sub">운영 개월 수에 따른 누적 유입 추이 (예시)</div>
          <div className="mini-chart">
            {bars.map((b, i) => (
              <div className="bar" key={i} style={{ height: b.h, animationDelay: `${i * 0.12}s` }}>
                {b.label && <span>{b.label}</span>}
              </div>
            ))}
          </div>
          <div className="hero__card-foot">
            <div>
              <b>+380%</b>
              <span style={{ display: 'block' }}>누적 유입 성장</span>
            </div>
            <div style={{ textAlign: 'right' }}>
              <b style={{ color: 'var(--blue-300)' }}>6~12개월</b>
              <span style={{ display: 'block' }}>임계점 도달</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
