// 관리자 화면 데이터 캐시 (stale-while-revalidate)
//
// 관리자는 메뉴를 자주 오간다. 캐시가 없으면 이동할 때마다 빈 화면 → 데이터 튀어나옴이
// 반복된다. 그래서 한 번 받은 목록은 이 메모리 캐시에 남겨두고, 다시 들어올 때는
// 캐시를 즉시 그려서 화면이 흔들리지 않게 한 뒤 뒤에서 조용히 최신값을 받아 바꾼다.
//
// 브라우저 새로고침하면 사라지는 세션 한정 캐시다. 관리자 데이터는 개인정보가 섞여 있어
// localStorage 같은 영속 저장소에는 두지 않는다.

const store = new Map() // key -> { data, at }

// 이만큼 지난 캐시는 화면에 먼저 보여주되 곧바로 다시 받아온다
export const STALE_MS = 30_000

export function peekCache(key) {
  return store.get(key)
}

export function writeCache(key, data) {
  store.set(key, { data, at: Date.now() })
}

// 다른 화면 데이터가 헐거워졌을 때 버린다 (예: 회원 등급을 바꾸면 대시보드 숫자가 달라진다).
// 버린 키는 다음에 그 화면에 들어갈 때 새로 받아온다.
export function clearCache(key) {
  if (key === undefined) store.clear()
  else store.delete(key)
}

// 캐시 키 — 화면마다 하나씩. 오타로 캐시가 갈리지 않게 여기 모아둔다.
export const CK = {
  members: 'members',
  articles: 'articles',
  performances: 'performances',
  operators: 'operators',
  consults: 'consults',
  requests: 'requests',
  inquiries: 'inquiries',
  consultingDocs: 'consulting-docs',
  dashboard: 'dashboard',
}
