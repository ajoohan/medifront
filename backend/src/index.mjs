// 메디프론트 백엔드 Lambda — 데이터 API + Cognito 가입 후처리
// 외부 패키지 없이 Lambda 런타임 내장 AWS SDK v3 만 사용한다.
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
  DynamoDBDocumentClient,
  QueryCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  GetCommand,
} from '@aws-sdk/lib-dynamodb'
import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  AdminUpdateUserAttributesCommand,
} from '@aws-sdk/client-cognito-identity-provider'

const TABLE = process.env.TABLE_NAME
const USER_POOL_ID = process.env.USER_POOL_ID
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
})
const cognito = new CognitoIdentityProviderClient({})

// URL 경로 → 엔티티. fields = 쓰기 허용 컬럼(기존 Postgres 스키마와 동일)
const RESOURCES = {
  members: {
    entity: 'members',
    // license_no = 의사면허번호. 가입자가 '의사' 등급을 신청할 때 입력하고,
    // 관리자가 확인 후 grade 를 '의사'로 승인한다. 관리자/본인만 조회 가능(인가 참고).
    fields: [
      'name',
      'email',
      'phone',
      'hospital',
      'specialty',
      'grade',
      'status',
      'joined_at',
      'license_no',
    ],
    defaults: () => ({
      name: '',
      phone: '-',
      hospital: '-',
      specialty: '-',
      grade: '일반',
      status: 'active',
      joined_at: today(),
    }),
    upsertKey: 'email',
  },
  'member-logs': {
    entity: 'member_logs',
    fields: ['member_id', 'content', 'logged_at'],
    defaults: () => ({ logged_at: now() }),
  },
  inquiries: {
    entity: 'inquiries',
    fields: ['email', 'name', 'title', 'content', 'answer', 'status', 'answered_at'],
    defaults: () => ({ name: '', status: 'open' }),
  },
  articles: {
    entity: 'articles',
    fields: ['title', 'content', 'thumbnail', 'excerpt', 'read', 'status', 'category', 'date'],
    defaults: () => ({ content: '', excerpt: '', read: '1분', status: 'visible', date: today() }),
  },
  consults: {
    entity: 'consults',
    fields: [
      'datetime',
      'place',
      'doctor_name',
      'doctor_phone',
      'doctor_email',
      'specialty',
      'region',
      'period',
      'content',
    ],
    defaults: () => ({}),
  },
  operators: {
    entity: 'operators',
    fields: ['name', 'email', 'phone', 'grade', 'created_at'],
    defaults: () => ({ name: '', phone: '-', grade: '매니저' }),
  },
  'consult-requests': {
    entity: 'consult_requests',
    fields: ['name', 'phone', 'specialty', 'opening_period', 'opening_region', 'message', 'status'],
    defaults: () => ({
      specialty: '',
      opening_period: '',
      opening_region: '',
      message: '',
      status: 'new',
    }),
  },
  performances: {
    entity: 'performances',
    fields: ['hospital', 'size', 'opening_year'],
    defaults: () => ({ size: '' }),
  },
}

const now = () => new Date().toISOString()
const today = () => now().slice(0, 10)
const skOf = (id) => String(id).padStart(12, '0')

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }
}

function parseBody(event) {
  if (!event.body) return {}
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body, 'base64').toString('utf8')
    : event.body
  return JSON.parse(raw)
}

// pk/sk 제거하고 프론트에 돌려줄 형태로
function toPublic(item) {
  if (!item) return null
  const { pk: _pk, sk: _sk, ...rest } = item
  return rest
}

async function nextId(entity) {
  const r = await ddb.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { pk: '_counter', sk: entity },
      UpdateExpression: 'ADD n :one',
      ExpressionAttributeValues: { ':one': 1 },
      ReturnValues: 'UPDATED_NEW',
    }),
  )
  return r.Attributes.n
}

// 단건 조회 (등급 변경 시 대상 회원의 이메일을 찾는 데 사용)
async function getItem(entity, id) {
  const r = await ddb.send(
    new GetCommand({ TableName: TABLE, Key: { pk: entity, sk: skOf(id) } }),
  )
  return r.Item || null
}

async function listAll(entity) {
  const items = []
  let cursor
  do {
    const r = await ddb.send(
      new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: 'pk = :pk',
        ExpressionAttributeValues: { ':pk': entity },
        ExclusiveStartKey: cursor,
      }),
    )
    items.push(...(r.Items || []))
    cursor = r.LastEvaluatedKey
  } while (cursor)
  return items
}

function pickFields(cfg, body) {
  const out = {}
  for (const f of cfg.fields) if (body[f] !== undefined) out[f] = body[f]
  return out
}

async function createItem(cfg, body) {
  const fields = pickFields(cfg, body)

  // members 는 이메일 기준 upsert (기존 Postgres on conflict(email) 동작 유지)
  if (cfg.upsertKey && fields[cfg.upsertKey] !== undefined) {
    const existing = (await listAll(cfg.entity)).find(
      (it) => it[cfg.upsertKey] === fields[cfg.upsertKey],
    )
    if (existing) {
      const merged = { ...existing, ...fields }
      await ddb.send(new PutCommand({ TableName: TABLE, Item: merged }))
      return toPublic(merged)
    }
  }

  const id = await nextId(cfg.entity)
  const item = {
    pk: cfg.entity,
    sk: skOf(id),
    id,
    created_at: now(),
    ...cfg.defaults(),
    ...fields,
  }
  await ddb.send(new PutCommand({ TableName: TABLE, Item: item }))
  return toPublic(item)
}

async function patchItem(cfg, id, body) {
  const fields = pickFields(cfg, body)
  const names = Object.keys(fields)
  if (names.length === 0) return { ok: true }
  await ddb.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { pk: cfg.entity, sk: skOf(id) },
      ConditionExpression: 'attribute_exists(pk)',
      UpdateExpression: `SET ${names.map((_, i) => `#f${i} = :v${i}`).join(', ')}`,
      ExpressionAttributeNames: Object.fromEntries(names.map((n, i) => [`#f${i}`, n])),
      ExpressionAttributeValues: Object.fromEntries(names.map((n, i) => [`:v${i}`, fields[n]])),
    }),
  )

  // 등급 변경은 Cognito 에도 반영해야 실제 권한이 바뀐다.
  // 매거진 접근은 JWT 의 custom:grade 로 판정되므로, DynamoDB 만 고치면
  // 관리자가 '의사'로 승인해도 해당 회원은 계속 접근하지 못한다(그 반대도 마찬가지).
  if (cfg.entity === 'members' && fields.grade) {
    const row = await getItem(cfg.entity, id)
    if (row?.email) {
      try {
        await cognito.send(
          new AdminUpdateUserAttributesCommand({
            UserPoolId: USER_POOL_ID,
            Username: row.email,
            UserAttributes: [{ Name: 'custom:grade', Value: fields.grade }],
          }),
        )
      } catch (e) {
        // Cognito 계정이 없는 수동 등록 회원 등은 무시 (목록상의 등급은 이미 반영됨)
        if (e.name !== 'UserNotFoundException') throw e
      }
    }
  }
  return { ok: true }
}

async function deleteItem(cfg, id) {
  await ddb.send(new DeleteCommand({ TableName: TABLE, Key: { pk: cfg.entity, sk: skOf(id) } }))
  // 회원 삭제 시 전화 로그도 함께 삭제 (기존 FK cascade 동작 유지)
  if (cfg.entity === 'members') {
    const logs = (await listAll('member_logs')).filter((l) => String(l.member_id) === String(id))
    for (const log of logs) {
      await ddb.send(
        new DeleteCommand({ TableName: TABLE, Key: { pk: 'member_logs', sk: skOf(log.id) } }),
      )
    }
  }
  return { ok: true }
}

// ── 관리자용 Cognito 계정 생성 ──

// 회원 수동 추가: 지정 비밀번호로 즉시 로그인 가능한 계정 생성 (인증 메일 불필요)
async function createUser({ email, password, name, phone, grade }) {
  if (!email || !password) return json(400, { error: 'email/password required' })
  try {
    await cognito.send(
      new AdminCreateUserCommand({
        UserPoolId: USER_POOL_ID,
        Username: email,
        MessageAction: 'SUPPRESS',
        UserAttributes: [
          { Name: 'email', Value: email },
          { Name: 'email_verified', Value: 'true' },
          { Name: 'name', Value: name || email.split('@')[0] },
          { Name: 'custom:phone', Value: phone || '-' },
          { Name: 'custom:grade', Value: grade || '일반' },
        ],
      }),
    )
  } catch (e) {
    if (e.name === 'UsernameExistsException') return json(409, { error: 'already-registered' })
    throw e
  }
  await cognito.send(
    new AdminSetUserPasswordCommand({
      UserPoolId: USER_POOL_ID,
      Username: email,
      Password: password,
      Permanent: true,
    }),
  )
  return json(200, { ok: true })
}

// 운영자 등록 안내 메일: 임시 비밀번호가 담긴 초대 메일 발송 (기존 매직링크 메일 대체)
async function inviteUser({ email, name }) {
  if (!email) return json(400, { error: 'email required' })
  const params = {
    UserPoolId: USER_POOL_ID,
    Username: email,
    DesiredDeliveryMediums: ['EMAIL'],
    UserAttributes: [
      { Name: 'email', Value: email },
      { Name: 'email_verified', Value: 'true' },
      { Name: 'name', Value: name || email.split('@')[0] },
      { Name: 'custom:grade', Value: '일반' },
    ],
  }
  try {
    await cognito.send(new AdminCreateUserCommand(params))
  } catch (e) {
    if (e.name === 'UsernameExistsException') {
      // 이미 계정이 있으면 초대 메일 재발송
      await cognito.send(new AdminCreateUserCommand({ ...params, MessageAction: 'RESEND' }))
    } else {
      throw e
    }
  }
  return json(200, { ok: true })
}

// ─────────────────────────────────────────────────────────────
// 인가(authorization)
//
// 인증(JWT 서명·만료 검증)은 API Gateway 의 Cognito authorizer 가 담당한다.
// 여기서는 "인증된 사람이 무엇을 할 수 있는지"만 결정한다.
// 기존 Postgres RLS(supabase/setup-6-lockdown.sql)와 동일한 권한 모델:
//
//   읽기  articles / performances        → 공개
//         members                        → 관리자는 전체, 회원은 본인 행만
//         그 외(상담·문의·운영자·로그)   → 관리자만
//   쓰기  inquiries / consult-requests   → 공개(제출만, 열람 불가)
//         그 외                          → 관리자만
//   auth/* (계정 생성·초대)              → 관리자만
//
// ⚠️ 이 검사를 제거하면 API 가 전면 개방됩니다. 반드시 유지하세요.
// ─────────────────────────────────────────────────────────────

// 인증 없이 허용되는 (method, resource) 조합 — 이 목록에 없으면 로그인 필요
const PUBLIC_ROUTES = [
  { method: 'GET', resource: 'articles' },
  { method: 'GET', resource: 'performances' },
  { method: 'POST', resource: 'inquiries' },
  { method: 'POST', resource: 'consult-requests' },
]

// 관리자만 읽을 수 있는 리소스 (개인정보·내부 데이터)
const ADMIN_READ_ONLY_RESOURCES = [
  'consults',
  'operators',
  'member-logs',
  'inquiries',
  'consult-requests',
]

function getAuth(event) {
  const claims = event.requestContext?.authorizer?.jwt?.claims
  if (!claims) return { authenticated: false, isAdmin: false, email: null }
  // cognito:groups 는 배열 또는 "[admin manager]" 형태 문자열로 올 수 있다
  const raw = claims['cognito:groups']
  const groups = Array.isArray(raw)
    ? raw
    : typeof raw === 'string'
      ? raw.replace(/^\[|\]$/g, '').split(/[\s,]+/).filter(Boolean)
      : []
  return {
    authenticated: true,
    isAdmin: groups.includes('admin'),
    email: claims.email || null,
  }
}

// ── HTTP API 라우터 ──
export async function handler(event) {
  const method = event.requestContext?.http?.method || 'GET'
  const path = (event.rawPath || '/').replace(/\/+$/, '') || '/'
  const [, seg1, seg2] = path.split('/')

  try {
    const auth = getAuth(event)
    const isPublic =
      !seg2 && PUBLIC_ROUTES.some((p) => p.method === method && p.resource === seg1)

    // 공개 경로가 아니면 로그인 필수 (API Gateway 가 이미 막지만 이중 방어)
    if (!isPublic && !auth.authenticated) return json(401, { error: 'unauthorized' })

    // 계정 생성·초대는 관리자만
    if (seg1 === 'auth') {
      if (!auth.isAdmin) return json(403, { error: 'forbidden' })
      const body = parseBody(event)
      if (method === 'POST' && seg2 === 'create-user') return await createUser(body)
      if (method === 'POST' && seg2 === 'invite') return await inviteUser(body)
      return json(404, { error: 'not found' })
    }

    const cfg = RESOURCES[seg1]
    if (!cfg) return json(404, { error: 'not found' })

    // 공개 제출(POST) 외의 모든 쓰기는 관리자만
    if (method !== 'GET' && !isPublic && !auth.isAdmin) return json(403, { error: 'forbidden' })

    // 관리자 전용 리소스 읽기 차단
    if (method === 'GET' && ADMIN_READ_ONLY_RESOURCES.includes(seg1) && !auth.isAdmin) {
      return json(403, { error: 'forbidden' })
    }

    if (method === 'GET' && !seg2) {
      let items = (await listAll(cfg.entity)).sort((a, b) => a.id - b.id)
      // members 는 관리자가 아니면 본인 행만 볼 수 있다
      if (seg1 === 'members' && !auth.isAdmin) {
        items = items.filter((it) => auth.email && it.email === auth.email)
      }
      // ?email= / ?member_id= 등 단순 동등 필터 지원
      const q = event.queryStringParameters || {}
      for (const [k, v] of Object.entries(q)) {
        if (cfg.fields.includes(k)) items = items.filter((it) => String(it[k]) === String(v))
      }
      return json(200, items.map(toPublic))
    }
    if (method === 'POST' && !seg2) return json(200, await createItem(cfg, parseBody(event)))
    if (method === 'PATCH' && seg2) return json(200, await patchItem(cfg, seg2, parseBody(event)))
    if (method === 'DELETE' && seg2) return json(200, await deleteItem(cfg, seg2))
    return json(404, { error: 'not found' })
  } catch (e) {
    console.error(e)
    if (e.name === 'ConditionalCheckFailedException') return json(404, { error: 'not found' })
    if (e instanceof SyntaxError) return json(400, { error: 'invalid json' })
    return json(500, { error: e.message || 'internal error' })
  }
}

// ── Cognito 가입 완료 트리거: 회원 목록(members)에 자동 등록 ──
// (기존 Postgres on_auth_user_created 트리거와 동일한 역할, 이미 있으면 건너뜀)
export async function postConfirmation(event) {
  try {
    const attrs = event.request?.userAttributes || {}
    const email = attrs.email
    if (email) {
      const existing = (await listAll('members')).find((m) => m.email === email)
      if (!existing) {
        const id = await nextId('members')
        await ddb.send(
          new PutCommand({
            TableName: TABLE,
            Item: {
              pk: 'members',
              sk: skOf(id),
              id,
              name: attrs.name || email.split('@')[0],
              email,
              phone: attrs['custom:phone'] || '-',
              hospital: '-',
              specialty: '-',
              // ⚠️ 신규 가입은 항상 '일반'으로 시작한다.
              // custom:grade 는 UserPoolClient WriteAttributes 에서 제외돼 있어
              // 가입자가 설정할 수 없지만, 여기서도 신뢰하지 않는다(다중 방어).
              // '의사' 승격은 관리자가 면허번호(license_no)를 확인한 뒤에만 수행한다.
              grade: '일반',
              // 가입 시 신청한 의사면허번호 — 관리자 승인 심사용
              license_no: attrs['custom:license_no'] || '',
              status: 'active',
              joined_at: today(),
              created_at: now(),
            },
          }),
        )
      }
    }
  } catch (e) {
    // 회원 목록 등록 실패가 가입 자체를 막지 않도록 로그만 남긴다
    console.error('postConfirmation failed:', e)
  }
  return event
}
