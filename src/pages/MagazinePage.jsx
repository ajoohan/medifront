import Magazine from '../components/Magazine'
import useReveal from '../hooks/useReveal'
import { useUser, canReadMagazine } from '../context/UserContext'
import MagazineGate from '../components/MagazineGate'

export default function MagazinePage() {
  useReveal()
  const { user } = useUser()

  if (!canReadMagazine(user)) {
    return <MagazineGate />
  }

  return (
    <>
      <section className="page-hero">
        <div className="page-hero__grid-bg" />
        <div className="container">
          <span className="eyebrow">MAGAZINE</span>
          <h1>
            병원 성장 <span className="accent">인사이트</span>
          </h1>
          <p>현장에서 검증된 병원 마케팅·경영·개원 노하우를 메디프론트가 정리해 드립니다.</p>
        </div>
      </section>
      <Magazine />
    </>
  )
}
