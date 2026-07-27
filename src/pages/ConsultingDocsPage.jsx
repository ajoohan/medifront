import useReveal from '../hooks/useReveal'
import { useUser } from '../context/UserContext'

// 회원 전용 컨설팅 자료 목록.
// 자료 본문은 public/ 의 단일 HTML 덱이라 라우터를 거치지 않는다 —
// 로그인 회원에게만 링크를 열어 준다(비로그인은 아래 안내 화면).
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

  // 비회원 — 자료 제목은 보여 주되 열람은 로그인 후로 안내
  if (!user) {
    return (
      <>
        <section className="page-hero">
          <div className="page-hero__grid-bg" />
          <div className="container">
            <span className="eyebrow">CONSULTING</span>
            <h1>
              메디프론트 <span className="accent">컨설팅 자료</span>
            </h1>
            <p>개원·입점 컨설팅 과정에서 실제로 사용하는 제안 자료를 공개합니다.</p>
          </div>
        </section>

        <section className="section">
          <div className="container">
            <div className="docs-gate reveal">
              <h2>회원 전용</h2>
              <p>
                메디프론트 컨설팅 자료는 회원만 열람할 수 있습니다.
                <br />
                로그인 후 이용 부탁드립니다.
              </p>
              <button className="btn btn--primary btn--lg" onClick={() => openLogin()}>
                로그인 / 회원가입
              </button>
            </div>

            {/* 어떤 자료가 있는지는 미리 보여 준다 (제목만) */}
            <ul className="docs-list docs-list--locked reveal">
              {DOCS.map((d) => (
                <li className="docs-item" key={d.file}>
                  <div className="docs-item__body">
                    <span className="docs-item__kicker">{d.kicker}</span>
                    <h3>{d.title}</h3>
                    <p>{d.desc}</p>
                  </div>
                  <span className="docs-item__lock" aria-hidden="true">
                    <svg
                      width="18"
                      height="18"
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
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </>
    )
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
                {/* 자료는 라우터 밖의 단일 HTML — 새 창으로 연다 */}
                <a className="docs-item" href={d.file} target="_blank" rel="noreferrer">
                  <div className="docs-item__body">
                    <span className="docs-item__kicker">{d.kicker}</span>
                    <h3>{d.title}</h3>
                    <p>{d.desc}</p>
                  </div>
                  <span className="docs-item__go">
                    {d.meta}
                    <b aria-hidden="true">↗</b>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  )
}
