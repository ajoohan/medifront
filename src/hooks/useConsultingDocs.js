import { useEffect, useState } from 'react'
import { CONSULTING_DOCS } from '../lib/consultingDocs'
import { loadDocFlags, visibleDocs } from '../lib/consultingDocsDb'

// 방문자에게 보여줄 컨설팅 자료 목록 (관리자가 숨긴 자료는 빠진다).
// 설정을 받아오기 전/받아오지 못했을 때는 정적 목록 그대로 — 자료가 사라져 보이지 않는다.
export default function useConsultingDocs() {
  const [docs, setDocs] = useState(CONSULTING_DOCS)

  useEffect(() => {
    let alive = true
    loadDocFlags().then((flags) => {
      if (alive && flags) setDocs(visibleDocs(CONSULTING_DOCS, flags))
    })
    return () => {
      alive = false
    }
  }, [])

  return docs
}
