import { Link, useParams } from 'react-router-dom'
import { loadArticles } from '../lib/magazineStore'
import { useUser, canReadMagazine } from '../context/UserContext'
import MagazineGate from '../components/MagazineGate'

function formatDate(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${y}. ${Number(m)}. ${Number(d)}.`
}

// 매거진 글 상세 — 관리자 에디터로 작성한 본문(이미지·유튜브 포함) 표시
export default function MagazineDetailPage() {
  const { id } = useParams()
  const { user } = useUser()

  if (!canReadMagazine(user)) {
    return <MagazineGate />
  }

  const article = loadArticles().find((a) => String(a.id) === String(id))
  const notFound = !article || article.status === 'hidden'

  if (notFound) {
    return (
      <section className="page-hero page-hero--gate">
        <div className="page-hero__grid-bg" />
        <div className="container">
          <span className="eyebrow">MAGAZINE</span>
          <h1>글을 찾을 수 없습니다</h1>
          <p>삭제되었거나 비공개 처리된 글입니다.</p>
          <div className="gate__actions">
            <Link to="/magazine" className="btn btn--light btn--lg">
              매거진 목록으로
            </Link>
          </div>
        </div>
      </section>
    )
  }

  const meta = [formatDate(article.date), article.read ? `${article.read} 읽기` : null]
    .filter(Boolean)
    .join(' · ')

  return (
    <>
      <section className="page-hero">
        <div className="page-hero__grid-bg" />
        <div className="container">
          <span className="eyebrow">MAGAZINE</span>
          <h1 className="mag-article__title">{article.title}</h1>
          <p>{meta}</p>
        </div>
      </section>

      <section className="section">
        <div className="container mag-article">
          {article.content ? (
            <div dangerouslySetInnerHTML={{ __html: article.content }} />
          ) : (
            <p>{article.excerpt}</p>
          )}

          <div className="mag-article__footer">
            <Link to="/magazine" className="btn btn--primary">
              ← 목록으로
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}
