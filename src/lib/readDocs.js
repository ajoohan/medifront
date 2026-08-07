// 내부 자료실에서 '이미 열어 본 자료'를 기억한다 — NEW 표시를 떼기 위한 것.
//
// 서버에 두지 않고 브라우저에 남긴다. 읽었는지 여부는 사람마다 다르고 자료 자체의
// 속성이 아니어서, 이것 때문에 서버 구조를 늘릴 만한 값이 아니다.
// 대신 브라우저를 바꾸면 다시 NEW 로 보인다 — 자료를 놓치는 쪽보다 나은 실수다.
//
// 계정별로 나눠 담는다. 한 컴퓨터를 여러 운영자가 쓰더라도 서로의 읽음 상태가
// 섞이지 않는다.
const KEY = 'medifront.internalDocs.read'

// 자료가 수정되면 다시 새 자료로 본다 — 내용이 바뀌었는데 읽은 것으로 두면
// 바뀐 것을 아무도 눈치채지 못한다.
export const readKeyOf = (doc) => `${doc.file || doc.id}@${doc.updatedAt || doc.date || ''}`

const storeKey = (email) => `${KEY}.${email || 'anon'}`

export function loadRead(email) {
  try {
    const raw = localStorage.getItem(storeKey(email))
    return new Set(raw ? JSON.parse(raw) : [])
  } catch {
    return new Set()
  }
}

// 최근 것부터 200개만 남긴다. 지운 자료의 기록이 끝없이 쌓이지 않게 한다.
export function markRead(email, key, current) {
  const next = new Set(current)
  if (next.has(key)) return next
  next.add(key)
  try {
    localStorage.setItem(storeKey(email), JSON.stringify([...next].slice(-200)))
  } catch {
    // 저장 공간이 막혀 있어도 화면 동작은 그대로 둔다
  }
  return next
}
