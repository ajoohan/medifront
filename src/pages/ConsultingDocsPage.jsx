import { useState } from 'react'
import useReveal from '../hooks/useReveal'
import { useUser } from '../context/UserContext'

// 회원 전용 컨설팅 자료 목록.
// 자료 본문은 public/ 의 단일 HTML 덱이라 라우터를 거치지 않는다 —
// 목록은 누구나 볼 수 있고, 열람은 로그인한 회원만 가능하다.
const DOCS = [
  {
    file: '/consulting_1.html',
    kicker: 'OPENING CONSULTING',
    title: '개원컨설팅 프로세스',
    desc: '입지 선정·계약부터 인테리어, 행정지원, 부설클리닉까지 개원 전 과정의 절차와 실제 사례를 정리했습니다.',
    meta: '16장',
  },
  {
    file: '/consulting_2.html',
    kicker: 'PHARMACY NEW MODEL',
    title: '약국 신(新)모델 입점 예시 — 파주운정',
    desc: '배후 세대·상권 인구 분석부터 의원·약국 입점 모델(M1/M2)까지, 신규 입점 전략 제안 자료입니다.',
    meta: '9장',
  },
]

export default function ConsultingDocsPage() {
  useReveal()
  const { user, openLogin } = useUser()
  // 비회원이 자료를 눌렀을 때 띄우는 안내
  const [gateOpen, setGateOpen] = useState(false)

  const openDoc = (e, file) => {
    if (user) return // 회원이면 링크 그대로 새 창
    e.preventDefault()
    setGateOpen(true)
  }

  return (
    <>
      <section className="page-hero">
        <div className="page-hero__grid-bg" />
        <div className="container">
          <span className="eyebrow">CONSULTING</span>
          <h1>
            메디프론트 <span className="accent">컨설팅 자료</span>
          </h1>
          <p>개원·입점 컨설팅 과정에서 실제로 사용하는 제안 자료입니다.</p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <ul className="docs-list reveal">
            {DOCS.map((d) => (
              <li key={d.file}>
                {/* 자료는 라우터 밖의 단일 HTML — 회원은 새 창, 비회원은 안내 */}
                <a
                  className="docs-item"
                  href={d.file}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => openDoc(e, d.file)}
                >
                  <div className="docs-item__body">
                    <span className="docs-item__kicker">{d.kicker}</span>
                    <h3>{d.title}</h3>
                    <p>{d.desc}</p>
                  </div>
                  <span className="docs-item__go">
                    {d.meta}
                    <b aria-hidden="true">{user ? '↗' : '🔒'}</b>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 비회원이 자료를 눌렀을 때 — 회원 전용 안내 */}
      {gateOpen && (
        <div
          className="modal-overlay"
          onClick={() => setGateOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div className="docs-modal" onClick={(e) => e.stopPropagation()}>
            <button
              className="login-modal__close"
              onClick={() => setGateOpen(false)}
              aria-label="닫기"
            >
              ✕
            </button>
            <div className="docs-modal__icon" aria-hidden="true">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <h3>회원 전용</h3>
            <p>
              메디프론트 컨설팅 자료는 회원만 열람할 수 있습니다.
              <br />
              로그인 후 이용 부탁드립니다.
            </p>
            <button
              className="btn btn--primary btn--lg"
              style={{ width: '100%' }}
              onClick={() => {
                setGateOpen(false)
                openLogin()
              }}
            >
              로그인 / 회원가입
            </button>
          </div>
        </div>
      )}
    </>
  )
}
