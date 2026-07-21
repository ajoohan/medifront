// 회원 목록 DB (AWS DynamoDB members — Lambda API 경유)
// 백엔드 배포: scripts/deploy-backend.sh (docs/aws-backend.md 참고)
import { apiGet, apiSend, isApiConfigured } from './api'

const PATH = '/members'

function toRow(m) {
  return {
    name: m.name,
    email: m.email,
    phone: m.phone,
    hospital: m.hospital,
    specialty: m.specialty,
    grade: m.grade,
    status: m.status,
    joined_at: m.joinedAt,
    license_no: m.licenseNo,
  }
}

function fromRow(r) {
  return {
    id: r.id,
    name: r.name || '',
    email: r.email,
    phone: r.phone || '-',
    hospital: r.hospital || '-',
    specialty: r.specialty || '-',
    grade: r.grade || '일반',
    joinedAt: r.joined_at,
    status: r.status || 'active',
    // 의사 회원 신청 시 입력한 면허번호 — 관리자 승인 심사용
    licenseNo: r.license_no || '',
    // 생년월일(YYMMDD) — 보건복지부 면허 조회에 함께 입력해야 한다
    birth: r.birth || '',
  }
}

// 목록 조회 — API 미설정/오류 시 null 반환 (호출부에서 목업 폴백)
export async function fetchMembers() {
  if (!isApiConfigured) return null
  const data = await apiGet(PATH)
  if (!data) return null
  return data
    .sort((a, b) => (b.joined_at || '').localeCompare(a.joined_at || '') || b.id - a.id)
    .map(fromRow)
}

// 추가/갱신 — 가입 트리거가 먼저 넣은 행이 있으면 이메일 기준으로 병합
export async function upsertMember(member) {
  const r = await apiSend('POST', PATH, toRow(member))
  return r.error ? { error: r.error } : { ok: true, member: fromRow(r.data) }
}

// 회원 정보 변경 (등급/상태/기본 정보)
export async function updateMemberDb(id, patch) {
  const row = {}
  for (const k of ['grade', 'status', 'name', 'phone', 'hospital', 'specialty']) {
    if (patch[k] !== undefined) row[k] = patch[k]
  }
  const r = await apiSend('PATCH', `${PATH}/${id}`, row)
  return r.error ? { error: r.error } : { ok: true }
}

export async function deleteMemberDb(id) {
  const r = await apiSend('DELETE', `${PATH}/${id}`)
  return r.error ? { error: r.error } : { ok: true }
}

// ── 회원 전화 로그 (DynamoDB member_logs) ──

const LOGS_PATH = '/member-logs'

// API 미설정/오류 시 null 반환 (호출부에서 브라우저 저장 폴백)
export async function fetchLogs(memberId) {
  if (!isApiConfigured) return null
  const data = await apiGet(LOGS_PATH, { member_id: memberId })
  if (!data) return null
  return data
    .sort((a, b) => (b.logged_at || '').localeCompare(a.logged_at || ''))
    .map((r) => ({ id: r.id, at: r.logged_at, content: r.content }))
}

export async function insertLog(memberId, content) {
  const r = await apiSend('POST', LOGS_PATH, { member_id: memberId, content })
  if (r.error) return { error: r.error }
  return { ok: true, log: { id: r.data.id, at: r.data.logged_at, content: r.data.content } }
}

export async function deleteLogDb(id) {
  const r = await apiSend('DELETE', `${LOGS_PATH}/${id}`)
  return r.error ? { error: r.error } : { ok: true }
}
