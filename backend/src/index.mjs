// 메디프론트 백엔드 Lambda — 데이터 API + Cognito 가입 후처리
// 외부 패키지 없이 Lambda 런타임 내장 AWS SDK v3 만 사용한다.
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
  DynamoDBDocumentClient,
  QueryCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb'
import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
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
    fields: ['name', 'email', 'phone', 'hospital', 'specialty', 'grade', 'status', 'joined_at'],
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

// ── HTTP API 라우터 ──
export async function handler(event) {
  const method = event.requestContext?.http?.method || 'GET'
  const path = (event.rawPath || '/').replace(/\/+$/, '') || '/'
  const [, seg1, seg2] = path.split('/')

  try {
    if (method === 'POST' && seg1 === 'auth') {
      const body = parseBody(event)
      if (seg2 === 'create-user') return await createUser(body)
      if (seg2 === 'invite') return await inviteUser(body)
      return json(404, { error: 'not found' })
    }

    const cfg = RESOURCES[seg1]
    if (!cfg) return json(404, { error: 'not found' })

    if (method === 'GET' && !seg2) {
      let items = (await listAll(cfg.entity)).sort((a, b) => a.id - b.id)
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
              grade: attrs['custom:grade'] || '일반',
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
