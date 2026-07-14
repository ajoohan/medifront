// ─────────────────────────────────────────────────────────
// 3단계: 내보낸 회원 계정(out/auth_users.json) → AWS Cognito 로 가져오기
//
// 사용 (백엔드 스택 배포 후):
//   USER_POOL_ID=ap-northeast-2_XXXXXXXXX node scripts/migrate/import-cognito.mjs
//
// USER_POOL_ID 는 scripts/deploy-backend.sh 출력에 표시된다.
//
// ※ 비밀번호는 Supabase 밖으로 꺼낼 수 없어 이전되지 않는다.
//   계정은 임의의 비밀번호로 생성되므로, 기존 회원은 로그인 화면의
//   [아이디/비밀번호 찾기]로 새 비밀번호를 1회 설정한 뒤 이용하면 된다.
// ─────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomBytes } from 'node:crypto'
import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
} from '@aws-sdk/client-cognito-identity-provider'

const USER_POOL_ID = process.env.USER_POOL_ID
if (!USER_POOL_ID) {
  console.error('USER_POOL_ID 환경변수가 필요합니다. (deploy-backend.sh 출력의 UserPoolId 값)')
  process.exit(1)
}

const REGION = process.env.AWS_REGION || 'ap-northeast-2'
const cognito = new CognitoIdentityProviderClient({ region: REGION })

const file = join(dirname(fileURLToPath(import.meta.url)), 'out', 'auth_users.json')
const users = JSON.parse(readFileSync(file, 'utf8'))

let created = 0
let skipped = 0
for (const u of users) {
  try {
    await cognito.send(
      new AdminCreateUserCommand({
        UserPoolId: USER_POOL_ID,
        Username: u.email,
        MessageAction: 'SUPPRESS', // 이전 시 메일 발송 안 함
        UserAttributes: [
          { Name: 'email', Value: u.email },
          { Name: 'email_verified', Value: 'true' },
          { Name: 'name', Value: u.name || u.email.split('@')[0] },
          { Name: 'custom:phone', Value: u.phone || '-' },
          { Name: 'custom:grade', Value: u.grade || '일반' },
        ],
      }),
    )
    // 임의의 영구 비밀번호로 확정 — 계정을 CONFIRMED 상태로 만들어
    // [아이디/비밀번호 찾기](재설정 코드)를 바로 쓸 수 있게 한다.
    await cognito.send(
      new AdminSetUserPasswordCommand({
        UserPoolId: USER_POOL_ID,
        Username: u.email,
        Password: `Mf!${randomBytes(18).toString('base64url')}`,
        Permanent: true,
      }),
    )
    created++
    console.log(`  ✓ ${u.email}`)
  } catch (e) {
    if (e.name === 'UsernameExistsException') {
      skipped++
      console.log(`  - ${u.email} (이미 존재 — 건너뜀)`)
    } else {
      console.error(`  ✗ ${u.email}: ${e.name} ${e.message}`)
    }
  }
}

console.log(`\n완료 — 생성 ${created}건, 건너뜀 ${skipped}건 (총 ${users.length}건)`)
console.log('기존 회원에게는 [아이디/비밀번호 찾기]로 비밀번호를 새로 설정하도록 안내하세요.')
