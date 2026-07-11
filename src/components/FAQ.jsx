import { useState } from 'react'
import { FAQ as FAQ_DATA } from '../data'

function FaqItem({ item, open, onToggle }) {
  return (
    <div className={`faq-item ${open ? 'open' : ''}`}>
      <button className="faq-item__q" onClick={onToggle} aria-expanded={open}>
        <span>{item.q}</span>
        <span className="plus">{open ? '−' : '+'}</span>
      </button>
      <div className="faq-item__a">
        <p>{item.a}</p>
      </div>
    </div>
  )
}

export default function FAQ() {
  const [openIdx, setOpenIdx] = useState(0)

  return (
    <section className="section section--soft" id="faq">
      <div className="container">
        <div className="section-head center reveal">
          <span className="eyebrow">FAQ</span>
          <h2>자주 묻는 질문</h2>
          <p>더 궁금한 점은 아래 1:1 문의하기를 이용해주세요.</p>
        </div>

        <div className="faq reveal">
          {FAQ_DATA.map((item, i) => (
            <FaqItem
              key={item.q}
              item={item}
              open={openIdx === i}
              onToggle={() => setOpenIdx(openIdx === i ? -1 : i)}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
