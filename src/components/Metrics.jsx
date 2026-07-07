import { METRICS } from '../data'

export default function Metrics() {
  return (
    <section className="metrics section--tight" id="why">
      <div className="container">
        <div className="metrics__grid reveal">
          {METRICS.map((m) => (
            <div className="metric" key={m.label}>
              <b>{m.value}</b>
              <span>{m.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
