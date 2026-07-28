import { useEffect, useState } from 'react'
import { CONSULTING_DOCS, sortForVisitors } from '../lib/consultingDocs'
import { loadDocFlags, withDocFlags } from '../lib/consultingDocsDb'

// 방문자에게 보여줄 컨설팅 자료 목록.
// 각 항목에 hidden 이 붙는다 — 관리자가 끈 자료는 목록에는 남되 열람은 막힌다.
// 정렬은 '열람 가능한 것 먼저, 그 안에서 최신순' (sortForVisitors).
// 설정을 받아오기 전/받아오지 못했을 때는 전부 열람 가능으로 둔다.
export default function useConsultingDocs() {
  const [docs, setDocs] = useState(() => sortForVisitors(withDocFlags(CONSULTING_DOCS, null)))

  useEffect(() => {
    let alive = true
    loadDocFlags().then((flags) => {
      if (alive && flags) setDocs(sortForVisitors(withDocFlags(CONSULTING_DOCS, flags)))
    })
    return () => {
      alive = false
    }
  }, [])

  return docs
}
