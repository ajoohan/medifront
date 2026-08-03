import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import useReveal from '../hooks/useReveal'
import { useUser } from '../context/UserContext'
import useConsultingDocs from '../hooks/useConsultingDocs'

// 컨설팅 자료 — 목록은 누구나 보고, 열람은 로그인 회원만.
// 회원이 자료를 고르면 같은 페이지 안(iframe)에서 바로 펼쳐 본다.
export default function ConsultingDocsPage() {
  useReveal()
  const { user, openLogin, openSignup } = useUser()
  const docs = useConsultingDocs() // 관리자가 숨긴 자료는 빠진 목록
  const [openDoc, setOpenDoc] = useState(null) // 지금 보고 있는 자료
  const [gateOpen, setGateOpen] = useState(false) // 비회원 안내
  const [copied, setCopied] = useState(false) // 공유 링크 복사 피드백
  const [params, setParams] = useSearchParams()
  const sharedId = params.get('doc') // 공유 링크로 지목된 자료
  const handledShare = useRef(false)

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

  // 공유 링크 만들기 — 자료 본문 주소가 아니라 컨설팅 목록 주소를 넘긴다.
  // 받은 사람이 비회원이면 목록에서 가입 안내를 만나고, 회원이면 그 자료가 바로 펼쳐진다.
  const shareDoc = async (doc) => {
    const url = `${window.location.origin}/consulting?doc=${encodeURIComponent(doc.id)}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt('아래 주소를 복사해 공유하세요', url)
    }
  }

  // 공유 링크(/consulting?doc=…)로 들어온 경우 —
  // 회원이면 그 자료를 바로 펼치고, 비회원이면 가입을 권하는 안내를 띄운다.
  // 한 번만 처리하고 주소에서 파라미터를 지운다(새로고침해도 다시 뜨지 않게).
  useEffect(() => {
    if (!sharedId || handledShare.current || docs.length === 0) return
    const doc = docs.find((d) => d.id === sharedId)
    handledShare.current = true
    setParams({}, { replace: true })
    if (!doc || doc.hidden) return
    if (user) setOpenDoc(doc)
    else setGateOpen(true)
  }, [sharedId, docs, user, setParams])

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
              <button
                type="button"
                className={`doc-viewer__share ${copied ? 'is-done' : ''}`}
                onClick={() => shareDoc(openDoc)}
              >
                {copied ? (
                  <>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path
                        d="m5 12.5 4.5 4.5L19 7.5"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    링크 복사됨
                  </>
                ) : (
                  <>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path
                        d="M10 13a4 4 0 0 0 5.7.3l3-3A4 4 0 0 0 13 4.7l-1.2 1.2"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M14 11a4 4 0 0 0-5.7-.3l-3 3A4 4 0 0 0 11 19.3l1.2-1.2"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    공유하기
                  </>
                )}
              </button>
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
              무료로 가입하시면 바로 보실 수 있습니다.
            </p>
            <button
              className="btn btn--primary btn--lg"
              style={{ width: '100%' }}
              onClick={() => {
                setGateOpen(false)
                openSignup()
              }}
            >
              무료 회원가입
            </button>
            <button
              type="button"
              className="docs-modal__alt"
              onClick={() => {
                setGateOpen(false)
                openLogin()
              }}
            >
              이미 회원이신가요? 로그인
            </button>
          </div>
        </div>
      )}
    </>
  )
}
