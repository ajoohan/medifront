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
  AdminGetUserCommand,
  AdminSetUserPasswordCommand,
  AdminUpdateUserAttributesCommand,
  AdminAddUserToGroupCommand,
  AdminRemoveUserFromGroupCommand,
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
    defaults: () => ({ name: '', phone: '-', grade: '운영자' }),
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

// ── 관리자 역할 ──
// 세 등급의 권한은 현재 모두 동일하다. 등급별로 권한을 나눌 때는 getAuth 가 돌려주는
// role 로 분기하면 되고, 이 표가 그 시작점이다.
//
// 역할은 Cognito 그룹으로만 정한다. 앱 클라이언트는 그룹을 쓸 수 없으므로(속성과 달리
// WriteAttributes 같은 설정이 아예 존재하지 않음) 가입자가 스스로 승격할 수 없다.
// 한 사람은 항상 한 역할 그룹에만 속한다.
const ROLE_BY_GROUP = {
  'super-admin': '최고관리자',
  admin: '일반관리자',
  operator: '운영자',
}
const GROUP_BY_ROLE = Object.fromEntries(Object.entries(ROLE_BY_GROUP).map(([g, r]) => [r, g]))
const ADMIN_GROUPS = Object.keys(ROLE_BY_GROUP)
const DEFAULT_ROLE = '운영자'

// 지정한 역할 그룹에만 속하게 한다 (다른 역할 그룹에서는 빼서 한 역할만 유지)
async function setRoleGroup(email, role) {
  const target = GROUP_BY_ROLE[role]
  if (!email || !target) return
  for (const g of ADMIN_GROUPS) {
    const cmd =
      g === target
        ? new AdminAddUserToGroupCommand({ UserPoolId: USER_POOL_ID, Username: email, GroupName: g })
        : new AdminRemoveUserFromGroupCommand({
            UserPoolId: USER_POOL_ID,
            Username: email,
            GroupName: g,
          })
    try {
      await cognito.send(cmd)
    } catch (e) {
      // 계정이 아직 없거나(수동 등록) 이미 그 그룹이 아닌 경우는 무시
      if (e.name !== 'UserNotFoundException') throw e
    }
  }
}

// 관리 권한 전체 회수 — 계정 자체는 남겨 일반 회원으로 계속 쓸 수 있게 한다
async function clearRoleGroups(email) {
  if (!email) return
  for (const g of ADMIN_GROUPS) {
    try {
      await cognito.send(
        new AdminRemoveUserFromGroupCommand({
          UserPoolId: USER_POOL_ID,
          Username: email,
          GroupName: g,
        }),
      )
    } catch (e) {
      if (e.name !== 'UserNotFoundException') throw e
    }
  }
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

  // 운영자 역할 변경도 같은 이유로 Cognito 그룹에 반영해야 한다 —
  // 행만 고치면 JWT 의 그룹은 그대로라 실권한이 바뀌지 않는다.
  if (cfg.entity === 'operators' && fields.grade) {
    const row = await getItem(cfg.entity, id)
    await setRoleGroup(row?.email, fields.grade)
  }
  return { ok: true }
}

async function deleteItem(cfg, id) {
  // 운영자는 역할 그룹 소속으로 관리 권한을 갖는다(inviteUser 참고). 행만 지우면
  // 계정이 그룹에 남아 관리자 권한이 그대로 유지되므로, 지우기 전에 이메일을 확보한다.
  const operatorEmail = cfg.entity === 'operators' ? (await getItem(cfg.entity, id))?.email : null

  await ddb.send(new DeleteCommand({ TableName: TABLE, Key: { pk: cfg.entity, sk: skOf(id) } }))
  await clearRoleGroups(operatorEmail)

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

// ── 운영자 지정: 두 경로 ──
// (1) 기존 회원(이미 가입) → grantRole:  새 계정 없이 역할 그룹만 부여
// (2) 신규(미가입)        → inviteUser: 새 계정 생성 + 임시 비밀번호 초대 메일 + 역할 부여
// 두 경우 모두 관리 API 접근과 매거진 등 회원 메뉴 열람이 이 그룹(JWT cognito:groups)으로 판정된다.

// (1) 기존 회원을 운영자로 지정 — 회원은 회원가입 때 만든 계정·비밀번호가 이미 있으므로
// 새 계정/임시 비밀번호 없이 역할 그룹만 부여한다. 계정 존재를 확인해 미가입 이메일에는
// 권한을 주지 않는다(그 경우는 신규 초대 경로를 써야 한다).
// TODO(SES): '운영자로 지정되었습니다' 안내 메일. Cognito 기본 발송기로는 임의 알림 메일을
//   보낼 수 없어 SES 연동이 선행돼야 한다. 연동 후 여기서 발송한다.
async function grantRole({ email, grade }) {
  if (!email) return json(400, { error: 'email required' })
  const role = GROUP_BY_ROLE[grade] ? grade : DEFAULT_ROLE
  try {
    await cognito.send(new AdminGetUserCommand({ UserPoolId: USER_POOL_ID, Username: email }))
  } catch (e) {
    if (e.name === 'UserNotFoundException') return json(404, { error: 'member-not-found' })
    throw e
  }
  await setRoleGroup(email, role)
  return json(200, { ok: true })
}

// (2) 신규(미가입) 대상 초대 — 새 Cognito 계정을 만들고 임시 비밀번호 초대 메일을 보낸다.
// 초대받은 사람은 임시 비밀번호로 첫 로그인해 새 비밀번호를 설정한다(completeNewPassword).
// 메일 문구는 template.yaml 의 InviteMessageTemplate.
async function inviteUser({ email, name, grade }) {
  if (!email) return json(400, { error: 'email required' })
  const role = GROUP_BY_ROLE[grade] ? grade : DEFAULT_ROLE
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
    // 이미 가입된 이메일이면 신규 초대가 아니라 '기존 회원 지정'을 써야 한다
    if (e.name === 'UsernameExistsException') return json(409, { error: 'already-registered' })
    throw e
  }
  await setRoleGroup(email, role)
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
  // 한 사람은 한 역할 그룹에만 속한다(setRoleGroup). 세 등급의 권한은 현재 동일하므로
  // 인가는 isAdmin 만 본다 — 등급별로 나눌 때 role 로 분기하면 된다.
  const adminGroup = ADMIN_GROUPS.find((g) => groups.includes(g))
  return {
    authenticated: true,
    isAdmin: !!adminGroup,
    role: adminGroup ? ROLE_BY_GROUP[adminGroup] : null,
    email: claims.email || null,
  }
}

// ── HTTP API 라우터 ──
export async function handler(event) {
  const method = event.requestContext?.http?.method || 'GET'
  const path = (event.rawPath || '/').replace(/\/+$/, '') || '/'
  const [, seg1, seg2] = path.split('/')

  // CORS preflight — 브라우저는 Authorization 헤더가 붙은 요청 전에 토큰 없이 OPTIONS 를
  // 보낸다. 이 요청이 authorizer 에 막혀 401 이 되면 실제 요청까지 차단되므로, OPTIONS 는
  // authorizer 를 우회(template.yaml 의 CorsPreflight 라우트)시키고 여기서 바로 200 을
  // 돌려준다. CORS 응답 헤더는 API Gateway 가 CorsConfiguration 대로 주입한다.
  if (method === 'OPTIONS') return { statusCode: 204, body: '' }

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
      if (method === 'POST' && seg2 === 'grant') return await grantRole(body) // 기존 회원 → 권한만
      if (method === 'POST' && seg2 === 'invite') return await inviteUser(body) // 신규 → 계정+초대메일
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
