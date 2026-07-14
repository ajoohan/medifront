// 성과 데이터 DB (AWS DynamoDB performances — Lambda API 경유)
import { apiGet, apiSend, isApiConfigured } from './api'

const PATH = '/performances'

function fromRow(r) {
  return {
    id: r.id,
    hospital: r.hospital,
    size: r.size || '',
    openingYear: r.opening_year,
  }
}

// 목록 (등록순) — API 미설정/오류 시 null (호출부에서 RESULTS 폴백)
export async function fetchPerformances() {
  if (!isApiConfigured) return null
  const data = await apiGet(PATH)
  if (!data) return null
  return data.sort((a, b) => a.id - b.id).map(fromRow)
}

export async function insertPerformance({ hospital, size, openingYear }) {
  const r = await apiSend('POST', PATH, { hospital, size, opening_year: openingYear })
  return r.error ? { error: r.error } : { ok: true, performance: fromRow(r.data) }
}

export async function deletePerformance(id) {
  const r = await apiSend('DELETE', `${PATH}/${id}`)
  return r.error ? { error: r.error } : { ok: true }
}
