// ─────────────────────────────────────────────────────────
// 1단계: Supabase 데이터 내보내기 → scripts/migrate/out/*.json
//
// 사용:
//   SUPABASE_SERVICE_KEY=<service_role 키> node scripts/migrate/export-supabase.mjs
//
// service_role 키 위치: Supabase 대시보드 > Project Settings > API > service_role
// (회원 계정 목록을 읽으려면 service_role 키가 필요합니다. 외부에 노출 금지!)
// ─────────────────────────────────────────────────────────
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ammzbaijoxoqzgbbwmuq.supabase.co'
const KEY = process.env.SUPABASE_SERVICE_KEY
if (!KEY) {
  console.error('SUPABASE_SERVICE_KEY 환경변수가 필요합니다. (대시보드 > Project Settings > API)')
  process.exit(1)
}

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), 'out')
mkdirSync(OUT_DIR, { recursive: true })

const HEADERS = { apikey: KEY, authorization: `Bearer ${KEY}` }
const TABLES = [
  'members',
  'member_logs',
  'inquiries',
  'articles',
  'consults',
  'operators',
  'consult_requests',
  'performances',
]

async function fetchTable(table) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*&order=id.asc`, {
    headers: HEADERS,
  })
  if (!res.ok) {
    // 테이블 미생성 등 — 빈 목록으로 계속 진행
    console.warn(`  ! ${table}: HTTP ${res.status} — 건너뜀 (테이블 미생성일 수 있음)`)
    return []
  }
  return res.json()
}

async function fetchAuthUsers() {
  const users = []
  for (let page = 1; ; page++) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?page=${page}&per_page=1000`, {
      headers: HEADERS,
    })
    if (!res.ok) throw new Error(`auth users HTTP ${res.status} — service_role 키인지 확인하세요`)
    const data = await res.json()
    const batch = data.users || []
    users.push(...batch)
    if (batch.length < 1000) break
  }
  // 이전에 필요한 필드만 보관
  return users
    .filter((u) => u.email)
    .map((u) => ({
      email: u.email,
      email_confirmed: !!u.email_confirmed_at,
      created_at: u.created_at,
      name: u.user_metadata?.name || '',
      phone: u.user_metadata?.phone || '-',
      grade: u.user_metadata?.grade || '일반',
    }))
}

for (const table of TABLES) {
  const rows = await fetchTable(table)
  writeFileSync(join(OUT_DIR, `${table}.json`), JSON.stringify(rows, null, 2))
  console.log(`  ✓ ${table}: ${rows.length}건`)
}

const users = await fetchAuthUsers()
writeFileSync(join(OUT_DIR, 'auth_users.json'), JSON.stringify(users, null, 2))
console.log(`  ✓ 회원 계정(auth): ${users.length}건`)
console.log(`\n완료 — ${OUT_DIR} 에 저장했습니다.`)
console.log('다음 단계: import-dynamodb.mjs (데이터) → import-cognito.mjs (회원 계정)')
