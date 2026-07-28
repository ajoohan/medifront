import { useEffect, useState } from 'react'
import useReveal from '../hooks/useReveal'
import { useUser } from '../context/UserContext'
import useConsultingDocs from '../hooks/useConsultingDocs'

// 컨설팅 자료 — 목록은 누구나 보고, 열람은 로그인 회원만.
// 회원이 자료를 고르면 같은 페이지 안(iframe)에서 바로 펼쳐 본다.
export default function ConsultingDocsPage() {
  useReveal()
  const { user, openLogin } = useUser()
  const docs = useConsultingDocs() // 관리자가 숨긴 자료는 빠진 목록
  const [openDoc, setOpenDoc] = useState(null) // 지금 보고 있는 자료
  const [gateOpen, setGateOpen] = useState(false) // 비회원 안내

  // 자료를 보는 동안에는 뒤 배경이 스크롤되지 않게 한다
  useEffect(() => {
    if (!openDoc) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e) => e.key === 'Escape' && setOpenDoc(null)
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', onKey)
    }
  }, [openDoc])

  const pick = (doc) => {
    if (doc.hidden) return // 준비 중 — 열람 불가
    if (!user) {
      setGateOpen(true)
      return
    }
    setOpenDoc(doc)
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
            {docs.map((d) => (
              <li key={d.file}>
                {/* 준비 중인 자료도 목록에는 남긴다 — 딤 처리하고 열리지는 않게 */}
                <button
                  type="button"
                  className={`docs-item ${d.hidden ? 'is-off' : ''}`}
                  onClick={() => pick(d)}
                  disabled={d.hidden}
                  aria-disabled={d.hidden || undefined}
                >
                  <div className="docs-item__body">
                    <span className="docs-item__kicker">{d.kicker}</span>
                    <h3>{d.title}</h3>
                    <p>{d.desc}</p>
                  </div>
                  {d.hidden ? (
                    <span className="docs-item__off">준비 중</span>
                  ) : (
                    <span className="docs-item__go" aria-hidden="true">
                      <svg viewBox="0 0 120 12" width="120" height="12" fill="none">
                        <path
                          d="M2 6h108"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                        />
                        <path
                          d="M104 1.5 110.5 6 104 10.5"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
          {docs.every((d) => d.hidden) && (
            <p className="docs-empty">현재 열람 가능한 자료를 준비하고 있습니다.</p>
          )}
        </div>
      </section>

      {/* 자료 열람 — 사이트 안에서 바로 펼친다 */}
      {openDoc && (
        <div className="doc-viewer" role="dialog" aria-modal="true" aria-label={openDoc.title}>
          <div className="doc-viewer__bar">
            <div className="doc-viewer__title">
              <span>{openDoc.kicker}</span>
              <b>{openDoc.title}</b>
            </div>
            <div className="doc-viewer__actions">
              <a className="doc-viewer__link" href={openDoc.file} target="_blank" rel="noreferrer">
                새 창으로 보기 ↗
              </a>
              <button
                type="button"
                className="doc-viewer__close"
                onClick={() => setOpenDoc(null)}
                aria-label="닫기"
              >
                ✕
              </button>
            </div>
          </div>
          <iframe className="doc-viewer__frame" src={openDoc.file} title={openDoc.title} />
        </div>
      )}

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
