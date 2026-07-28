import { useCallback, useEffect, useRef, useState } from 'react'
import { peekCache, writeCache, STALE_MS } from '../lib/adminCache'

// 관리자 화면의 데이터 로딩을 한 곳에서 처리한다.
//
//   status  'loading'   최초 로드 — 보여줄 게 아직 없다 → 스켈레톤
//           'ready'     데이터 있음(캐시일 수도 있다)
//   fresh   false 면 캐시를 보여주는 중이고 뒤에서 최신값을 받고 있다 → '새로고침 중' 표시
//   data    fetcher 가 돌려준 값. null 이면 API 미연결(각 화면이 안내 문구로 처리)
//
// 캐시가 있으면 화면을 곧바로 그리므로 메뉴를 오갈 때 깜빡임이 없다.
export default function useAdminData(key, fetcher) {
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const cached = peekCache(key)
  const [state, setState] = useState(() =>
    cached
      ? { data: cached.data, status: 'ready', fresh: Date.now() - cached.at < STALE_MS }
      : { data: undefined, status: 'loading', fresh: false },
  )

  useEffect(() => {
    const hit = peekCache(key)
    // 방금 받아온 캐시라면 다시 부르지 않는다 (메뉴를 빠르게 오갈 때 중복 호출 방지)
    if (hit && Date.now() - hit.at < STALE_MS) {
      setState({ data: hit.data, status: 'ready', fresh: true })
      return
    }
    let alive = true
    if (hit) setState({ data: hit.data, status: 'ready', fresh: false })
    fetcherRef.current().then((res) => {
      if (!alive) return
      writeCache(key, res)
      setState({ data: res, status: 'ready', fresh: true })
    })
    return () => {
      alive = false
    }
  }, [key])

  // 화면에서 목록을 바꿀 때 — 상태와 캐시를 함께 갱신한다
  const setData = useCallback(
    (next) => {
      setState((s) => {
        const data = typeof next === 'function' ? next(s.data) : next
        writeCache(key, data)
        return { ...s, data, status: 'ready' }
      })
    },
    [key],
  )

  return { ...state, setData }
}
