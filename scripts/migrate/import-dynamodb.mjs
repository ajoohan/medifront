// ─────────────────────────────────────────────────────────
// 2단계: 내보낸 데이터(out/*.json) → AWS DynamoDB 로 가져오기
//
// 사용 (백엔드 스택 배포 후):
//   TABLE_NAME=medifront-backend-data node scripts/migrate/import-dynamodb.mjs
//
// TABLE_NAME 은 scripts/deploy-backend.sh 출력에 표시된다.
// AWS 자격증명은 aws configure 로 등록된 값을 그대로 사용한다.
// ─────────────────────────────────────────────────────────
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, BatchWriteCommand, PutCommand } from '@aws-sdk/lib-dynamodb'

const TABLE = process.env.TABLE_NAME
if (!TABLE) {
  console.error('TABLE_NAME 환경변수가 필요합니다. (deploy-backend.sh 출력의 TABLE_NAME 값)')
  process.exit(1)
}

const REGION = process.env.AWS_REGION || 'ap-northeast-2'
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }), {
  marshallOptions: { removeUndefinedValues: true },
})

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), 'out')
const ENTITIES = [
  'members',
  'member_logs',
  'inquiries',
  'articles',
  'consults',
  'operators',
  'consult_requests',
  'performances',
]

const skOf = (id) => String(id).padStart(12, '0')

async function batchPut(items) {
  for (let i = 0; i < items.length; i += 25) {
    let requests = items.slice(i, i + 25).map((Item) => ({ PutRequest: { Item } }))
    while (requests.length > 0) {
      const r = await ddb.send(new BatchWriteCommand({ RequestItems: { [TABLE]: requests } }))
      requests = r.UnprocessedItems?.[TABLE] || []
      if (requests.length > 0) await new Promise((ok) => setTimeout(ok, 500))
    }
  }
}

for (const entity of ENTITIES) {
  const file = join(OUT_DIR, `${entity}.json`)
  if (!existsSync(file)) {
    console.warn(`  ! ${entity}.json 없음 — 건너뜀`)
    continue
  }
  const rows = JSON.parse(readFileSync(file, 'utf8'))
  // null 값 제거(빈 값은 저장하지 않아도 프론트가 기본값 처리)
  const items = rows.map((row) => {
    const clean = Object.fromEntries(Object.entries(row).filter(([, v]) => v !== null))
    return { pk: entity, sk: skOf(row.id), ...clean }
  })
  await batchPut(items)

  // id 채번 카운터를 기존 최대 id 로 설정 (신규 데이터가 이어서 증가)
  const maxId = rows.reduce((m, r) => Math.max(m, r.id || 0), 0)
  await ddb.send(
    new PutCommand({ TableName: TABLE, Item: { pk: '_counter', sk: entity, n: maxId } }),
  )
  console.log(`  ✓ ${entity}: ${rows.length}건 (카운터=${maxId})`)
}

console.log('\n완료 — DynamoDB 데이터 이전이 끝났습니다.')
console.log('다음 단계: import-cognito.mjs (회원 계정)')
