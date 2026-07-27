import { useState } from 'react'
import InquiryModal from './InquiryModal'

// 화면 하단 고정 상담 배너 — 좌측 이미지 · 중앙 메시지 · 우측 CTA
// (로그인 없이 이용 가능. 닫으면 이 방문 동안 다시 뜨지 않는다)
export default function FloatingInquiry() {
  const [open, setOpen] = useState(false)
  const [closed, setClosed] = useState(false)

  if (closed) return null

  return (
    <>
      <aside className="cta-bar" role="complementary" aria-label="무료 상담 안내">
        <div className="cta-bar__inner">
          {/* 좌측 — 신뢰 이미지 */}
          <div className="cta-bar__visual" aria-hidden="true">
            <img src="/consulting-cycle.svg" alt="" />
          </div>

          {/* 중앙 — 메시지 */}
          <div className="cta-bar__body">
            <div className="cta-bar__eyebrow">
              <span className="cta-bar__badge">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M12 2 4 6v6c0 5 3.4 9.4 8 10 4.6-.6 8-5 8-10V6l-8-4Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinejoin="round"
                  />
                  <path
                    d="m9 12 2 2 4-4"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                개원 컨설팅 전문
              </span>
              <span className="cta-bar__sub">20+ 개원 수행 · 폐업률 0% · 데이터 기반</span>
            </div>

            <p className="cta-bar__title">
              무료 정밀 상담으로 <b>입지·비용·개원 일정</b>이 막히는 지점을 한 번에 짚어드립니다.
            </p>

            <ul className="cta-bar__tags">
              {['상권·입지 분석', '임대조건 협상', '개원 일정 설계'].map((t) => (
                <li key={t}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
                    <path
                      d="m8.5 12 2.5 2.5 4.5-5"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  {t}
                </li>
              ))}
            </ul>
          </div>

          {/* 우측 — CTA */}
          <div className="cta-bar__action">
            <button className="cta-bar__btn" onClick={() => setOpen(true)}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M12 2 4 6v6c0 5 3.4 9.4 8 10 4.6-.6 8-5 8-10V6l-8-4Z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
              </svg>
              무료 상담 신청
              <b aria-hidden="true">→</b>
            </button>
            <span className="cta-bar__note">문의를 남겨주신 원장님께 연락드립니다</span>
          </div>

          <button className="cta-bar__close" onClick={() => setClosed(true)} aria-label="배너 닫기">
            ✕
          </button>
        </div>
      </aside>
      <InquiryModal open={open} onClose={() => setOpen(false)} />
    </>
  )
}
