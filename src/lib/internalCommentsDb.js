// 내부 자료 의견 스레드 DB (AWS DynamoDB internal_comments — Lambda API 경유)
//
// ⚠️ 자료실과 같은 사내 데이터다. 백엔드에서 관리자 전용으로 잠겨 있으므로
// 공개 화면에서 이 모듈을 쓰지 말 것.
import { apiGet, apiSend, isApiConfigured } from './api'

const PATH = '/internal-comments'

// 자료 한 건을 가리키는 열쇠.
// 자료실에는 두 종류가 섞여 있다 — DB 에 쓴 글(숫자 id)과 파일형 자료(문자 id).
// 접두어를 붙여 둘이 같은 값으로 겹치지 않게 한다.
export const docKeyOf = (doc) => (doc.file ? `f:${doc.id}` : `d:${doc.id}`)

function fromRow(r) {
  return {
    id: r.id,
    docKey: r.doc_key,
    author: r.author || '이름 없음',
    authorEmail: r.author_email || '',
    content: r.content || '',
    createdAt: r.created_at || '',
  }
}

// 자료 한 건의 의견 (오래된 순 — 대화 흐름대로 읽히게)
export async function fetchComments(docKey) {
  if (!isApiConfigured) return null
  const rows = await apiGet(PATH, { doc_key: docKey })
  if (!rows) return null
  return rows.map(fromRow).sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
}

// 작성자 이메일은 서버가 토큰에서 확정하므로 여기서 보내지 않는다
export async function insertComment({ docKey, author, content }) {
  const r = await apiSend('POST', PATH, { doc_key: docKey, author, content })
  return r.error ? { error: r.error } : { ok: true, comment: fromRow(r.data) }
}

// 본인 글만 지울 수 있다 (서버에서도 확인한다)
export async function deleteComment(id) {
  const r = await apiSend('DELETE', `${PATH}/${id}`)
  return r.error ? { error: r.error } : { ok: true }
}
