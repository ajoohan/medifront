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
  AdminInitiateAuthCommand,
  AdminRespondToAuthChallengeCommand,
} from '@aws-sdk/client-cognito-identity-provider'
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses'

const TABLE = process.env.TABLE_NAME
const USER_POOL_ID = process.env.USER_POOL_ID
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
})
const cognito = new CognitoIdentityProviderClient({})
const ses = new SESClient({})
const MAIL_FROM = 'MEDIFRONT <no-reply@medifront.co.kr>'

// HTML 특수문자 이스케이프 — 메일에 사용자 이름을 넣기 전 주입 방지
const escapeHtml = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  )

// 운영자 지정 안내 메일 본문(HTML). {{name}}/{{role}} 은 발송 시 치환한다.
const GRANT_EMAIL_HTML = `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light only" />
    <title>메디프론트 운영자 지정 안내</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f4f6f6;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">메디프론트 운영자로 지정되었습니다.</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f6;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(4,33,31,0.08);">
            <!-- 헤더 -->
            <tr>
              <td align="center" style="background-color:#04211f;padding:28px 32px;">
                <img src="https://medifront.co.kr/logo-light.png" alt="MEDIFRONT" height="26" style="height:26px;width:auto;display:block;border:0;color:#ffffff;font-size:18px;font-weight:800;" />
              </td>
            </tr>
            <!-- 본문 -->
            <tr>
              <td style="padding:40px 40px 8px 40px;font-family:-apple-system,'Apple SD Gothic Neo','Malgun Gothic','맑은 고딕',Roboto,sans-serif;">
                <h1 style="margin:0 0 12px 0;font-size:20px;line-height:1.4;color:#0b1a18;font-weight:700;">운영자로 지정되었습니다</h1>
                <p style="margin:0;font-size:15px;line-height:1.7;color:#33504b;">{{name}} 님, 관리자가 회원님을 메디프론트 <b style="color:#0b6b60;">{{role}}</b>(으)로 지정했습니다. 기존에 사용하시던 계정으로 로그인하면 관리자 화면을 이용하실 수 있습니다. <b>새 비밀번호는 필요하지 않습니다.</b></p>
              </td>
            </tr>
            <!-- 버튼 -->
            <tr>
              <td align="center" style="padding:28px 40px 16px 40px;">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td align="center" style="background-color:#10a696;border-radius:10px;">
                      <a href="https://medifront.co.kr/admin" style="display:inline-block;padding:15px 40px;font-family:-apple-system,'Apple SD Gothic Neo','Malgun Gothic','맑은 고딕',Roboto,sans-serif;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;">관리자 화면 열기</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <!-- 안내 -->
            <tr>
              <td style="padding:8px 40px 40px 40px;font-family:-apple-system,'Apple SD Gothic Neo','Malgun Gothic','맑은 고딕',Roboto,sans-serif;">
                <p style="margin:0;font-size:13px;line-height:1.7;color:#5c7871;">버튼이 열리지 않으면 <a href="https://medifront.co.kr/admin" style="color:#10a696;text-decoration:none;">medifront.co.kr/admin</a> 에 직접 접속해 주세요. 비밀번호를 잊으셨다면 로그인 화면의 '아이디/비밀번호 찾기'를 이용해 주세요.</p>
              </td>
            </tr>
            <!-- 푸터 -->
            <tr>
              <td style="background-color:#f4f6f6;padding:24px 40px;font-family:-apple-system,'Apple SD Gothic Neo','Malgun Gothic','맑은 고딕',Roboto,sans-serif;border-top:1px solid #e6ebea;">
                <p style="margin:0 0 4px 0;font-size:13px;font-weight:700;color:#33504b;">메디프론트 MEDIFRONT</p>
                <p style="margin:0;font-size:12px;line-height:1.6;color:#93aaa4;">병원 성장의 파트너 · <a href="https://medifront.co.kr" style="color:#10a696;text-decoration:none;">medifront.co.kr</a><br />본 메일은 발신 전용입니다.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`

// 회원 등급 변경 안내 메일 본문(HTML) — 다른 공식 메일과 같은 디자인.
// {{name}}/{{grade}}/{{extra}} 는 발송 시 치환한다.
const GRADE_EMAIL_HTML = `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light only" />
    <title>메디프론트 회원 등급 변경 안내</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f4f6f6;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">메디프론트 회원 등급이 변경되었습니다.</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f6;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(4,33,31,0.08);">
            <!-- 헤더 -->
            <tr>
              <td align="center" style="background-color:#04211f;padding:28px 32px;">
                <img src="https://medifront.co.kr/logo-light.png" alt="MEDIFRONT" height="26" style="height:26px;width:auto;display:block;border:0;color:#ffffff;font-size:18px;font-weight:800;" />
              </td>
            </tr>
            <!-- 본문 -->
            <tr>
              <td style="padding:40px 40px 8px 40px;font-family:-apple-system,'Apple SD Gothic Neo','Malgun Gothic','맑은 고딕',Roboto,sans-serif;">
                <h1 style="margin:0 0 12px 0;font-size:20px;line-height:1.4;color:#0b1a18;font-weight:700;">회원 등급이 변경되었습니다</h1>
                <p style="margin:0;font-size:15px;line-height:1.7;color:#33504b;">{{name}} 님의 메디프론트 회원 등급이 <b style="color:#0b6b60;">{{grade}} 회원</b>(으)로 변경되었습니다.{{extra}} 다시 로그인하시면 바로 적용됩니다.</p>
              </td>
            </tr>
            <!-- 버튼 -->
            <tr>
              <td align="center" style="padding:28px 40px 16px 40px;">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td align="center" style="background-color:#10a696;border-radius:10px;">
                      <a href="https://medifront.co.kr" style="display:inline-block;padding:15px 40px;font-family:-apple-system,'Apple SD Gothic Neo','Malgun Gothic','맑은 고딕',Roboto,sans-serif;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;">메디프론트 열기</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <!-- 안내 -->
            <tr>
              <td style="padding:8px 40px 40px 40px;font-family:-apple-system,'Apple SD Gothic Neo','Malgun Gothic','맑은 고딕',Roboto,sans-serif;">
                <p style="margin:0;font-size:13px;line-height:1.7;color:#5c7871;">등급 변경에 관해 궁금한 점이 있으시면 사이트의 1:1 문의로 알려주세요.</p>
              </td>
            </tr>
            <!-- 푸터 -->
            <tr>
              <td style="background-color:#f4f6f6;padding:24px 40px;font-family:-apple-system,'Apple SD Gothic Neo','Malgun Gothic','맑은 고딕',Roboto,sans-serif;border-top:1px solid #e6ebea;">
                <p style="margin:0 0 4px 0;font-size:13px;font-weight:700;color:#33504b;">메디프론트 MEDIFRONT</p>
                <p style="margin:0;font-size:12px;line-height:1.6;color:#93aaa4;">병원 성장의 파트너 · <a href="https://medifront.co.kr" style="color:#10a696;text-decoration:none;">medifront.co.kr</a><br />본 메일은 발신 전용입니다.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`

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
      // 가입 2단계(유형·이름·휴대폰·약관) 완료 여부 — 소셜(구글/네이버) 첫 가입은
      // false 로 시작하고, 로그인 직후 뜨는 2/2 폼을 제출해야 true 가 된다.
      'profile_done',
      // 가입 시 선택한 회원유형(의사/병원/일반) — 표시용. 실권한은 grade 로만 판정한다.
      'member_type',
      // 휴대폰 본인인증(실명인증) 결과. verified/ci_hash/di 는 서버(verifyPhone)만 기록하며
      // 이 목록에 없어도 되지만, 관리자 화면 조회를 위해 읽기용으로 둔다.
      'verified',
      // 생년월일(YYMMDD) — 의사 회원 신청자의 보건복지부 면허 조회에 필요.
      // 휴대폰 본인인증을 켜면 인증기관이 확인한 값으로 대체된다.
      'birth',
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

// pk/sk 제거하고 프론트에 돌려줄 형태로.
// 본인인증 식별값(ci_hash/di)은 중복 가입 대조용 내부 데이터라 절대 내보내지 않는다 —
// 인증 여부는 verified 로만 알린다.
function toPublic(item) {
  if (!item) return null
  const { pk: _pk, sk: _sk, ci_hash: _ci, di: _di, ...rest } = item
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
  // 등급/역할 변경 안내 메일용 — 갱신 전 값을 확보해 실제로 바뀐 경우에만 알린다
  const gradeChanging =
    (cfg.entity === 'members' || cfg.entity === 'operators') && fields.grade !== undefined
  const before = gradeChanging ? await getItem(cfg.entity, id) : null
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
    const row = before
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
      // 실제로 등급이 바뀐 경우에만 공식 폼으로 안내 메일 발송 (실패해도 변경은 유지)
      if (row.grade !== fields.grade) {
        try {
          await sendGradeEmail(row.email, row.name || row.email.split('@')[0], fields.grade)
        } catch (e) {
          console.error('grade notification email failed', e)
        }
      }
    }
  }

  // 운영자 역할 변경도 같은 이유로 Cognito 그룹에 반영해야 한다 —
  // 행만 고치면 JWT 의 그룹은 그대로라 실권한이 바뀌지 않는다.
  if (cfg.entity === 'operators' && fields.grade) {
    await setRoleGroup(before?.email, fields.grade)
    // 역할이 실제로 바뀐 경우 '운영자 지정' 공식 폼으로 안내 (신규 지정 메일과 동일 디자인)
    if (before?.email && before.grade !== fields.grade && GROUP_BY_ROLE[fields.grade]) {
      try {
        await sendGrantEmail(
          before.email,
          before.name || before.email.split('@')[0],
          fields.grade,
        )
      } catch (e) {
        console.error('role notification email failed', e)
      }
    }
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

// '회원 등급 변경' 안내 메일 발송(SES) — 관리자가 등급을 바꾸면(의사 승인 등) 회원에게 알린다.
async function sendGradeEmail(email, name, grade) {
  const extra =
    grade === '의사'
      ? ' 이제 의사 회원 전용 매거진을 포함한 모든 서비스를 이용하실 수 있습니다.'
      : ''
  const html = GRADE_EMAIL_HTML.replaceAll('{{name}}', escapeHtml(name))
    .replaceAll('{{grade}}', escapeHtml(grade))
    .replaceAll('{{extra}}', extra)
  await ses.send(
    new SendEmailCommand({
      Source: MAIL_FROM,
      Destination: { ToAddresses: [email] },
      Message: {
        Subject: { Data: '[메디프론트] 회원 등급 변경 안내', Charset: 'UTF-8' },
        Body: { Html: { Data: html, Charset: 'UTF-8' } },
      },
    }),
  )
}

// '운영자로 지정' 안내 메일 발송(SES). 회원은 이미 비밀번호가 있으므로 임시비번이 아닌
// 안내형이다. {{name}}/{{role}} 은 발송 시 치환한다. (템플릿: scratchpad/email-grant.html)
async function sendGrantEmail(email, name, role) {
  const html = GRANT_EMAIL_HTML.replaceAll('{{name}}', escapeHtml(name)).replaceAll(
    '{{role}}',
    escapeHtml(role),
  )
  await ses.send(
    new SendEmailCommand({
      Source: MAIL_FROM,
      Destination: { ToAddresses: [email] },
      Message: {
        Subject: { Data: '[메디프론트] 운영자로 지정되었습니다', Charset: 'UTF-8' },
        Body: { Html: { Data: html, Charset: 'UTF-8' } },
      },
    }),
  )
}

// (1) 기존 회원을 운영자로 지정 — 회원은 회원가입 때 만든 계정·비밀번호가 이미 있으므로
// 새 계정/임시 비밀번호 없이 역할 그룹만 부여한다. 계정 존재를 확인해 미가입 이메일에는
// 권한을 주지 않는다(그 경우는 신규 초대 경로를 써야 한다).
async function grantRole({ email, grade }) {
  if (!email) return json(400, { error: 'email required' })
  const role = GROUP_BY_ROLE[grade] ? grade : DEFAULT_ROLE
  let name = email.split('@')[0]
  try {
    const u = await cognito.send(
      new AdminGetUserCommand({ UserPoolId: USER_POOL_ID, Username: email }),
    )
    const nameAttr = (u.UserAttributes || []).find((a) => a.Name === 'name')
    if (nameAttr?.Value) name = nameAttr.Value
  } catch (e) {
    if (e.name === 'UserNotFoundException') return json(404, { error: 'member-not-found' })
    throw e
  }
  await setRoleGroup(email, role)
  // 안내 메일 발송이 실패해도 권한 부여 자체는 완료된 것으로 둔다(메일은 부가).
  try {
    await sendGrantEmail(email, name, role)
  } catch (e) {
    console.error('grant notification email failed', e)
  }
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
// 휴대폰 본인인증 (실명인증) — /auth/verify-phone (공개 엔드포인트)
//
// 흐름: 프론트가 인증사 팝업으로 본인인증 → 인증 식별자(impUid)를 여기로 보냄
//   → 서버가 인증사 서버에 조회(위조 불가) → 이름·생년월일·성별·휴대폰·CI/DI 확보
//   → 중복 가입 차단(CI 해시 대조) → 10분짜리 티켓을 발급
//   → 가입 완료 시 티켓을 제출하면 회원 정보에 '본인인증 완료'로 기록된다.
//
// ⚠️ CI(개인 식별값)는 원본을 저장하지 않고 해시만 남긴다. 같은 사람인지 대조하는
//    용도로는 해시로 충분하며, 유출 시 피해를 줄일 수 있다.
//
// 인증사 키(VERIFY_API_KEY/SECRET)가 없으면 이 기능 전체가 꺼진 것으로 동작한다 —
// 계약 전에도 사이트는 지금까지처럼 정상 가입된다.
// ─────────────────────────────────────────────────────────────
const VERIFY_KEY = process.env.VERIFY_API_KEY || ''
const VERIFY_SECRET = process.env.VERIFY_API_SECRET || ''
const isVerifyConfigured = () => !!(VERIFY_KEY && VERIFY_SECRET)

const sha256 = async (s) => {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

// 인증사 조회 — 여기만 갈아끼우면 다른 인증사로 교체된다.
// (현재 구현: 포트원 V1 REST. 계약 후 발급받는 키를 VERIFY_API_KEY/SECRET 에 넣으면 동작)
async function fetchCertification(impUid) {
  const tokenRes = await fetch('https://api.iamport.kr/users/getToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imp_key: VERIFY_KEY, imp_secret: VERIFY_SECRET }),
  })
  const token = (await tokenRes.json().catch(() => ({})))?.response?.access_token
  if (!token) throw new Error('verify-token-failed')
  const certRes = await fetch(
    `https://api.iamport.kr/certifications/${encodeURIComponent(impUid)}`,
    { headers: { Authorization: token } },
  )
  const cert = (await certRes.json().catch(() => ({})))?.response
  if (!cert || cert.certified !== true) throw new Error('verify-not-certified')
  return {
    name: cert.name || '',
    phone: String(cert.phone || '').replace(/[^0-9]/g, ''),
    birth: cert.birthday || '', // YYYY-MM-DD
    gender: cert.gender || '',
    ci: cert.unique_key || '', // 기관 간 동일인 식별값
    di: cert.unique_in_site || '', // 사이트 내 동일인 식별값
  }
}

// 본인인증 결과 확인 + 가입용 티켓 발급
async function verifyPhone(body) {
  if (!isVerifyConfigured()) return json(501, { error: 'verify-not-configured' })
  const impUid = String(body.impUid || '')
  if (!impUid) return json(400, { error: 'impUid required' })

  let cert
  try {
    cert = await fetchCertification(impUid)
  } catch (e) {
    console.error('certification failed', e)
    return json(401, { error: 'verify-failed' })
  }
  if (!cert.ci) return json(401, { error: 'verify-failed' })
  const ciHash = await sha256(cert.ci)

  // 같은 사람이 이미 가입돼 있으면 중복 가입을 막는다 (명의 도용·다중 계정 방지)
  const dup = (await listAll('members')).find((m) => m.ci_hash === ciHash)
  if (dup) return json(409, { error: 'already-verified-member' })

  // 가입 완료 시 제출할 10분짜리 티켓
  const ticket = `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, '')
  await ddb.send(
    new PutCommand({
      TableName: TABLE,
      Item: {
        pk: '_phone_verify',
        sk: ticket,
        name: cert.name,
        phone: cert.phone,
        birth: cert.birth,
        gender: cert.gender,
        ci_hash: ciHash,
        di: cert.di,
        exp: Date.now() + 10 * 60_000,
      },
    }),
  )
  // 프론트에는 표시용 정보만 돌려준다 — CI/DI 는 절대 내보내지 않는다
  return json(200, { ticket, name: cert.name, phone: cert.phone })
}

// 티켓 사용(1회용) — 유효하면 인증 정보를 돌려주고 즉시 폐기한다
async function consumeVerifyTicket(ticket) {
  if (!ticket) return null
  const key = { pk: '_phone_verify', sk: String(ticket) }
  const r = await ddb.send(new GetCommand({ TableName: TABLE, Key: key }))
  if (!r.Item) return null
  await ddb.send(new DeleteCommand({ TableName: TABLE, Key: key }))
  if (r.Item.exp < Date.now()) return null
  return r.Item
}

// 회원 레코드에 넣을 본인인증 필드 (티켓이 없으면 빈 객체)
const verifiedFields = (v) =>
  v
    ? {
        verified: true,
        verified_at: now(),
        ci_hash: v.ci_hash,
        di: v.di,
        birth: v.birth,
        gender: v.gender,
      }
    : {}

// ─────────────────────────────────────────────────────────────
// 네이버 로그인 (/auth/naver — 공개 엔드포인트)
//
// 네이버는 Cognito 가 기본 지원하지 않는다. 프론트가 네이버 인증 후 받은 code 를
// 여기로 보내면: ① 네이버와 코드 교환(시크릿은 Lambda 환경변수) ② 프로필(이메일) 조회
// ③ 같은 이메일의 Cognito 계정 확보(없으면 생성 — 네이버가 이미 이메일을 검증했으므로
// 인증 메일 생략) ④ 커스텀 인증 챌린지(아래 트리거 3종)로 정식 Cognito 토큰 발급.
// 발급된 토큰은 이메일 로그인과 완전히 동일하게 동작한다(API authorizer 통과).
// ─────────────────────────────────────────────────────────────

// Cognito 비밀번호 정책(8자+영문+숫자)을 만족하는 일회성 무작위 비밀번호.
// 소셜 가입 계정용 — 본인이 비밀번호를 쓰려면 '아이디/비밀번호 찾기'로 재설정하면 된다.
const randomPw = () => `Nv1${crypto.randomUUID()}`

async function naverLogin(body) {
  const naverId = process.env.NAVER_CLIENT_ID
  const naverSecret = process.env.NAVER_CLIENT_SECRET
  const appClientId = process.env.CLIENT_ID
  if (!naverId || !naverSecret || !appClientId) return json(501, { error: 'naver-not-configured' })
  const code = String(body.code || '')
  if (!code) return json(400, { error: 'code required' })

  // ① 네이버 코드 → 액세스 토큰
  const tokenRes = await fetch(
    'https://nid.naver.com/oauth2.0/token?' +
      new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: naverId,
        client_secret: naverSecret,
        code,
        state: String(body.state || ''),
      }),
  )
  const token = await tokenRes.json().catch(() => ({}))
  if (!token.access_token) return json(401, { error: 'naver-token-failed' })

  // ② 프로필 조회 — 이메일은 필수 (네이버 앱 설정에서 '필수 제공'으로 지정해야 한다)
  const profileRes = await fetch('https://openapi.naver.com/v1/nid/me', {
    headers: { Authorization: `Bearer ${token.access_token}` },
  })
  const profile = (await profileRes.json().catch(() => ({})))?.response || {}
  const email = String(profile.email || '')
    .trim()
    .toLowerCase()
  if (!email) return json(400, { error: 'naver-no-email' })
  const name = profile.name || profile.nickname || email.split('@')[0]
  const phone = String(profile.mobile || '').replace(/\s/g, '')

  // ③ Cognito 계정 확보
  try {
    const u = await cognito.send(
      new AdminGetUserCommand({ UserPoolId: USER_POOL_ID, Username: email }),
    )
    // 관리자 초대 후 한 번도 로그인하지 않은 계정이면 임시 비밀번호 상태를 정리한다
    if (u.UserStatus === 'FORCE_CHANGE_PASSWORD') {
      await cognito.send(
        new AdminSetUserPasswordCommand({
          UserPoolId: USER_POOL_ID,
          Username: email,
          Password: randomPw(),
          Permanent: true,
        }),
      )
    }
  } catch (e) {
    if (e.name !== 'UserNotFoundException') throw e
    await cognito.send(
      new AdminCreateUserCommand({
        UserPoolId: USER_POOL_ID,
        Username: email,
        MessageAction: 'SUPPRESS', // 초대 메일 없음 — 네이버 인증으로 즉시 가입 완료
        UserAttributes: [
          { Name: 'email', Value: email },
          { Name: 'email_verified', Value: 'true' },
          { Name: 'name', Value: name },
          { Name: 'custom:phone', Value: phone || '-' },
          // ⚠️ 신규 가입은 항상 '일반' — '의사' 승격은 관리자 승인으로만 (postConfirmation 과 동일 원칙)
          { Name: 'custom:grade', Value: '일반' },
        ],
      }),
    )
    await cognito.send(
      new AdminSetUserPasswordCommand({
        UserPoolId: USER_POOL_ID,
        Username: email,
        Password: randomPw(),
        Permanent: true,
      }),
    )
  }

  // ④ 회원 목록 등록 — 신규는 profile_done:false 로 시작해 가입 2/2 폼으로 유도된다.
  //    (AdminCreateUser 는 postConfirmation 트리거를 태우지 않으므로 여기서 직접 등록)
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
          name,
          email,
          phone: phone || '-',
          hospital: '-',
          specialty: '-',
          grade: '일반',
          license_no: '',
          status: 'active',
          joined_at: today(),
          created_at: now(),
          profile_done: false,
        },
      }),
    )
  }

  // ⑤ 1회용 코드를 심고 커스텀 챌린지로 Cognito 토큰 발급
  const secret = `${crypto.randomUUID()}${crypto.randomUUID()}`
  await ddb.send(
    new PutCommand({
      TableName: TABLE,
      Item: { pk: '_social_auth', sk: email, secret, exp: Date.now() + 60_000 },
    }),
  )
  const init = await cognito.send(
    new AdminInitiateAuthCommand({
      UserPoolId: USER_POOL_ID,
      ClientId: appClientId,
      AuthFlow: 'CUSTOM_AUTH',
      AuthParameters: { USERNAME: email },
    }),
  )
  const resp = await cognito.send(
    new AdminRespondToAuthChallengeCommand({
      UserPoolId: USER_POOL_ID,
      ClientId: appClientId,
      ChallengeName: 'CUSTOM_CHALLENGE',
      Session: init.Session,
      ChallengeResponses: { USERNAME: email, ANSWER: secret },
    }),
  )
  const a = resp.AuthenticationResult
  if (!a?.IdToken) return json(500, { error: 'token-issue-failed' })
  return json(200, {
    idToken: a.IdToken,
    accessToken: a.AccessToken,
    refreshToken: a.RefreshToken,
    // 가입 2/2 폼 필요 여부 — 신규이거나 아직 제출하지 않은 회원이면 false
    profileDone: existing ? existing.profile_done !== false : false,
  })
}

// ── 가입 2/2 폼 제출 (소셜 가입자 — 유형·이름·휴대폰·약관) ──
// 로그인한 본인의 회원 정보만 갱신한다. grade 는 절대 바꾸지 않는다('의사' 승격은
// 관리자 승인으로만). '의사' 유형 신청 시 면허번호를 저장해 관리자 심사에 쓴다.
async function completeProfile(auth, body) {
  const memberType = ['의사', '병원', '일반'].includes(body.memberType) ? body.memberType : '일반'
  const licenseNo = memberType === '의사' ? String(body.licenseNo || '').trim() : ''
  const row = (await listAll('members')).find((m) => m.email === auth.email)
  if (!row) return json(404, { error: 'member not found' })

  // 본인인증이 켜져 있으면 티켓이 필수이고, 이름·휴대폰은 인증된 값만 신뢰한다
  const verified = await consumeVerifyTicket(body.verifyTicket)
  if (isVerifyConfigured() && !verified && !row.verified) {
    return json(400, { error: 'verify-required' })
  }
  const name = verified ? verified.name : String(body.name || '').trim()
  const phone = verified ? verified.phone : String(body.phone || '').trim()
  if (!name || !phone) return json(400, { error: 'name and phone required' })

  // 생년월일 — 본인인증 값이 있으면 그것을 쓰고(신뢰), 없으면 입력값(YYMMDD 6자리)
  const birth = String(body.birth || '')
    .replace(/\D/g, '')
    .slice(0, 6)
  const updated = {
    ...row,
    name,
    phone,
    member_type: memberType,
    license_no: licenseNo || row.license_no || '',
    ...(birth ? { birth } : {}),
    profile_done: true,
    ...verifiedFields(verified),
  }
  await ddb.send(new PutCommand({ TableName: TABLE, Item: updated }))
  // JWT(이름 표시)에도 반영 — 실패해도 회원 정보 저장은 유지한다
  try {
    await cognito.send(
      new AdminUpdateUserAttributesCommand({
        UserPoolId: USER_POOL_ID,
        Username: auth.email,
        UserAttributes: [
          { Name: 'name', Value: name },
          { Name: 'custom:phone', Value: phone },
          ...(licenseNo ? [{ Name: 'custom:license_no', Value: licenseNo }] : []),
        ],
      }),
    )
  } catch (e) {
    console.error('attr update failed:', e)
  }
  return json(200, toPublic(updated))
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

    // 네이버 로그인 콜백 교환 — 로그인 전 단계라 공개(template.yaml 의 PublicNaverLogin)
    if (method === 'POST' && seg1 === 'auth' && seg2 === 'naver') {
      return await naverLogin(parseBody(event))
    }

    // 휴대폰 본인인증 — 가입 도중(로그인 전)에도 써야 하므로 공개.
    // 인증사 서버 조회를 통과해야만 티켓이 나가므로 공개해도 안전하다.
    if (method === 'POST' && seg1 === 'auth' && seg2 === 'verify-phone') {
      return await verifyPhone(parseBody(event))
    }
    // 본인인증 사용 여부 — 프론트가 버튼 노출/필수 여부를 판단하는 데 쓴다
    if (method === 'GET' && seg1 === 'auth' && seg2 === 'verify-config') {
      return json(200, { enabled: isVerifyConfigured() })
    }

    const isPublic =
      !seg2 && PUBLIC_ROUTES.some((p) => p.method === method && p.resource === seg1)

    // 공개 경로가 아니면 로그인 필수 (API Gateway 가 이미 막지만 이중 방어)
    if (!isPublic && !auth.authenticated) return json(401, { error: 'unauthorized' })

    // 가입 2/2 폼 제출 — 로그인한 본인의 회원 정보만 갱신 (관리자 아니어도 허용)
    if (method === 'POST' && seg1 === 'members' && seg2 === 'complete-profile') {
      return await completeProfile(auth, parseBody(event))
    }

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
        // 가입 화면에서 본인인증을 마쳤다면 그 티켓으로 인증 정보를 확정한다
        const verified = await consumeVerifyTicket(attrs['custom:verify_ticket'])
        const id = await nextId('members')
        await ddb.send(
          new PutCommand({
            TableName: TABLE,
            Item: {
              pk: 'members',
              sk: skOf(id),
              id,
              // 본인인증을 거쳤다면 인증기관이 확인한 이름·휴대폰을 우선한다
              name: verified?.name || attrs.name || email.split('@')[0],
              email,
              phone: verified?.phone || attrs['custom:phone'] || '-',
              hospital: '-',
              specialty: '-',
              // ⚠️ 신규 가입은 항상 '일반'으로 시작한다.
              // custom:grade 는 UserPoolClient WriteAttributes 에서 제외돼 있어
              // 가입자가 설정할 수 없지만, 여기서도 신뢰하지 않는다(다중 방어).
              // '의사' 승격은 관리자가 면허번호(license_no)를 확인한 뒤에만 수행한다.
              grade: '일반',
              // 가입 시 신청한 의사면허번호 — 관리자 승인 심사용
              license_no: attrs['custom:license_no'] || '',
              // 생년월일(YYMMDD) — 면허 조회에 필요. 본인인증을 켜면 인증값이 우선한다.
              birth: attrs['custom:birth'] || '',
              status: 'active',
              joined_at: today(),
              created_at: now(),
              // 이메일 가입은 가입 화면에서 2/2(유형·이름·휴대폰)를 이미 끝냈고,
              // 소셜(구글 등 외부 IdP, userName 이 'google_...' 형태)은 아직이므로
              // false 로 시작해 로그인 직후 2/2 폼으로 유도한다.
              profile_done: !/^[a-z]+_/i.test(String(event.userName || '')),
              ...verifiedFields(verified),
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

// ── 비밀번호 재설정 메일 (Cognito 커스텀 메시지 트리거) ──
// Cognito 는 회원가입 인증과 비밀번호 재설정에 같은 템플릿(template.yaml 의
// VerificationMessageTemplate)을 쓴다. 재설정 메일이 "회원가입 인증 코드"로
// 나가면 헷갈리므로, 재설정일 때만 아래 전용 문구(같은 공식 디자인)로 바꾼다.
const RESET_EMAIL_HTML = `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light only" />
    <title>메디프론트 비밀번호 재설정 코드</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f4f6f6;">
    <!-- 미리보기 텍스트(받은편지함 목록에 보이는 요약) -->
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">메디프론트 비밀번호 재설정 코드입니다.</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f6;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(4,33,31,0.08);">
            <!-- 헤더 -->
            <tr>
              <td align="center" style="background-color:#04211f;padding:28px 32px;">
                <img src="https://medifront.co.kr/logo-light.png" alt="MEDIFRONT" height="26" style="height:26px;width:auto;display:block;border:0;color:#ffffff;font-size:18px;font-weight:800;" />
              </td>
            </tr>
            <!-- 본문 -->
            <tr>
              <td style="padding:40px 40px 8px 40px;font-family:-apple-system,'Apple SD Gothic Neo','Malgun Gothic','맑은 고딕',Roboto,sans-serif;">
                <h1 style="margin:0 0 12px 0;font-size:20px;line-height:1.4;color:#0b1a18;font-weight:700;">비밀번호 재설정 코드</h1>
                <p style="margin:0;font-size:15px;line-height:1.7;color:#33504b;">아래 6자리 코드를 재설정 화면의 입력란에 넣고 새 비밀번호를 설정해 주세요.</p>
              </td>
            </tr>
            <!-- 코드 박스 -->
            <tr>
              <td style="padding:24px 40px 8px 40px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td align="center" style="background-color:#e7f7f5;border:1px solid #10a696;border-radius:12px;padding:22px 16px;">
                      <div style="font-family:-apple-system,'Apple SD Gothic Neo','Malgun Gothic',monospace;font-size:36px;font-weight:800;letter-spacing:10px;color:#0b6b60;">{####}</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <!-- 안내 -->
            <tr>
              <td style="padding:16px 40px 40px 40px;font-family:-apple-system,'Apple SD Gothic Neo','Malgun Gothic','맑은 고딕',Roboto,sans-serif;">
                <p style="margin:0;font-size:13px;line-height:1.7;color:#5c7871;">본인이 요청하지 않았다면 이 메일을 무시하셔도 됩니다 — 비밀번호는 바뀌지 않습니다. 코드는 타인에게 알려주지 마세요.</p>
              </td>
            </tr>
            <!-- 푸터 -->
            <tr>
              <td style="background-color:#f4f6f6;padding:24px 40px;font-family:-apple-system,'Apple SD Gothic Neo','Malgun Gothic','맑은 고딕',Roboto,sans-serif;border-top:1px solid #e6ebea;">
                <p style="margin:0 0 4px 0;font-size:13px;font-weight:700;color:#33504b;">메디프론트 MEDIFRONT</p>
                <p style="margin:0;font-size:12px;line-height:1.6;color:#93aaa4;">병원 성장의 파트너 · <a href="https://medifront.co.kr" style="color:#10a696;text-decoration:none;">medifront.co.kr</a><br />본 메일은 발신 전용입니다.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`

export async function customMessage(event) {
  if (event.triggerSource === 'CustomMessage_ForgotPassword') {
    event.response.emailSubject = '[메디프론트] 비밀번호 재설정 코드'
    // codeParameter('{####}' 자리표시자)를 본문에 심으면 Cognito 가 실제 코드로 치환한다
    event.response.emailMessage = RESET_EMAIL_HTML.replace('{####}', event.request.codeParameter)
  }
  return event
}

// ── 네이버 로그인용 커스텀 인증 챌린지 트리거 3종 ──
// /auth/naver(naverLogin)가 DynamoDB('_social_auth')에 심어 둔 1회용 코드를 맞혀야만
// 토큰이 발급된다. 외부에서 CUSTOM_AUTH 를 시도하면 코드가 없으므로(무작위 값으로
// 대체되어) 절대 통과할 수 없고, 코드는 읽는 즉시 폐기되어 재사용도 불가능하다.

// 흐름 결정: 첫 시도면 챌린지 발급, 정답이면 토큰 발급, 오답이면 즉시 실패
export async function defineAuthChallenge(event) {
  const session = event.request.session || []
  const last = session[session.length - 1]
  if (event.request.userNotFound) {
    event.response.issueTokens = false
    event.response.failAuthentication = true
  } else if (last?.challengeName === 'CUSTOM_CHALLENGE' && last.challengeResult === true) {
    event.response.issueTokens = true
    event.response.failAuthentication = false
  } else if (last && last.challengeResult === false) {
    // 오답 1회 즉시 실패 — 무차별 대입 여지를 남기지 않는다
    event.response.issueTokens = false
    event.response.failAuthentication = true
  } else {
    event.response.issueTokens = false
    event.response.failAuthentication = false
    event.response.challengeName = 'CUSTOM_CHALLENGE'
  }
  return event
}

// 정답 준비: 심어 둔 1회용 코드를 꺼내고(즉시 폐기), 없으면 맞힐 수 없는 무작위 값
export async function createAuthChallenge(event) {
  let answer = `denied-${crypto.randomUUID()}`
  const email = String(event.request.userAttributes?.email || '')
    .trim()
    .toLowerCase()
  if (email) {
    const key = { pk: '_social_auth', sk: email }
    const r = await ddb.send(new GetCommand({ TableName: TABLE, Key: key }))
    if (r.Item) {
      await ddb.send(new DeleteCommand({ TableName: TABLE, Key: key }))
      if (r.Item.exp > Date.now()) answer = r.Item.secret
    }
  }
  event.response.privateChallengeParameters = { answer }
  event.response.challengeMetadata = 'SOCIAL_LOGIN'
  return event
}

// 정답 검증
export async function verifyAuthChallenge(event) {
  const expected = event.request.privateChallengeParameters?.answer
  event.response.answerCorrect = !!expected && event.request.challengeAnswer === expected
  return event
}
