// Cognito 인증 클라이언트 (기존 Supabase Auth 대체)
// 토큰은 localStorage 에 보관하고, 만료 시 refresh token 으로 자동 갱신한다.
import {
  CognitoIdentityProviderClient,
  SignUpCommand,
  ConfirmSignUpCommand,
  ResendConfirmationCodeCommand,
  InitiateAuthCommand,
  RespondToAuthChallengeCommand,
  ForgotPasswordCommand,
  ConfirmForgotPasswordCommand,
  GlobalSignOutCommand,
} from '@aws-sdk/client-cognito-identity-provider'
import { awsConfig, isAuthConfigured } from './awsConfig'

export { isAuthConfigured }

const TOKENS_KEY = 'medifront_auth_tokens'
const client = new CognitoIdentityProviderClient({ region: awsConfig.region })

// Cognito 예외 → 문자열 에러 (LoginModal 등의 tr() 이 매칭)
const errStr = (e) => `${e.name || 'Error'}: ${e.message || ''}`

// ── 토큰 보관/해석 ──

function loadTokens() {
  try {
    return JSON.parse(localStorage.getItem(TOKENS_KEY))
  } catch {
    return null
  }
}
const saveTokens = (t) => localStorage.setItem(TOKENS_KEY, JSON.stringify(t))
const clearTokens = () => localStorage.removeItem(TOKENS_KEY)

// JWT payload 디코드 (검증은 불필요 — 표시에만 사용, 권한 검증은 서버 몫)
function decode(jwt) {
  try {
    const base64 = jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(decodeURIComponent(escape(atob(base64))))
  } catch {
    return null
  }
}

// 관리자 역할 — backend/src/index.mjs 의 ROLE_BY_GROUP 과 반드시 같아야 한다.
// 세 등급의 권한은 현재 동일하며, 화면에서 등급별로 나눌 때 user.adminRole 로 분기한다.
const ROLE_BY_GROUP = {
  'super-admin': '최고관리자',
  admin: '일반관리자',
  operator: '운영자',
}

function claimsToUser(claims) {
  if (!claims?.email) return null
  // cognito:groups 는 배열 또는 "[admin operator]" 형태 문자열로 올 수 있다.
  // (Lambda 인가(getAuth)와 동일한 규칙 — 양쪽이 같은 기준으로 역할을 판정해야 한다)
  const raw = claims['cognito:groups']
  const groups = Array.isArray(raw)
    ? raw
    : typeof raw === 'string'
      ? raw
          .replace(/^\[|\]$/g, '')
          .split(/[\s,]+/)
          .filter(Boolean)
      : []
  // 한 사람은 한 역할 그룹에만 속한다(백엔드 setRoleGroup)
  const roleGroup = Object.keys(ROLE_BY_GROUP).find((g) => groups.includes(g))
  return {
    email: claims.email,
    name: claims.name || claims.email.split('@')[0],
    phone: claims['custom:phone'] || '-',
    grade: claims['custom:grade'] || '일반',
    // 역할은 서버가 서명한 JWT 의 그룹으로만 정해진다(가입자가 조작 불가)
    isAdmin: !!roleGroup,
    adminRole: roleGroup ? ROLE_BY_GROUP[roleGroup] : null,
  }
}

// ── 인증 상태 변경 구독 (UserContext 가 사용) ──

const listeners = new Set()
export function onAuthChange(cb) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}
const emit = (user) => listeners.forEach((cb) => cb(user))

// ── 세션 조회 (필요 시 자동 갱신) ──

// 유효한 ID 토큰을 반환한다. 만료 임박 시 refresh 로 갱신하며, 실패하면 null.
// API 인증 헤더(api.js)와 세션 복원(getSession)이 공용으로 쓴다 —
// 백엔드 authorizer 가 Authorization 헤더의 ID 토큰을 검증한다(template.yaml).
export async function getValidIdToken() {
  const tokens = loadTokens()
  if (!tokens?.idToken) return null
  const claims = decode(tokens.idToken)
  // 만료 1분 전까지는 그대로 사용
  if (claims?.exp && claims.exp * 1000 > Date.now() + 60_000) return tokens.idToken
  if (!tokens.refreshToken) {
    clearTokens()
    return null
  }
  try {
    const r = await client.send(
      new InitiateAuthCommand({
        ClientId: awsConfig.clientId,
        AuthFlow: 'REFRESH_TOKEN_AUTH',
        AuthParameters: { REFRESH_TOKEN: tokens.refreshToken },
      }),
    )
    const a = r.AuthenticationResult
    saveTokens({
      idToken: a.IdToken,
      accessToken: a.AccessToken,
      refreshToken: tokens.refreshToken,
    })
    return a.IdToken
  } catch {
    clearTokens()
    return null
  }
}

export async function getSession() {
  const idToken = await getValidIdToken()
  return idToken ? claimsToUser(decode(idToken)) : null
}

// ── 가입/로그인/복구 ──

// ⚠️ grade(회원등급)는 여기서 보내지 않습니다.
// 매거진 접근이 grade === '의사' 로 결정되므로, 가입자가 등급을 직접 지정하면
// 누구나 면허 확인 없이 의사 전용 콘텐츠를 볼 수 있게 됩니다.
// 신규 가입은 항상 '일반'으로 시작하고, '의사' 승격은 관리자가 면허번호를
// 확인한 뒤에만 수행합니다. (Cognito UserPoolClient 의 WriteAttributes 에서도
// custom:grade 를 제외해 서버 차원에서 막고 있습니다.)
export async function signUp({ email, password, name, phone, licenseNo }) {
  if (!isAuthConfigured) return { error: 'not-configured' }
  try {
    await client.send(
      new SignUpCommand({
        ClientId: awsConfig.clientId,
        Username: email,
        Password: password,
        UserAttributes: [
          { Name: 'email', Value: email },
          { Name: 'name', Value: name || email.split('@')[0] },
          { Name: 'custom:phone', Value: phone || '-' },
          // 의사 회원 신청 시에만 입력 — 관리자 승인 심사용
          { Name: 'custom:license_no', Value: licenseNo || '' },
        ],
      }),
    )
    return { ok: true }
  } catch (e) {
    if (e.name === 'UsernameExistsException') return { error: 'already-registered' }
    return { error: errStr(e) }
  }
}

// 가입 인증 코드 확인 (메일로 받은 6자리 숫자)
export async function confirmSignUp({ email, code }) {
  if (!isAuthConfigured) return { error: 'not-configured' }
  try {
    await client.send(
      new ConfirmSignUpCommand({
        ClientId: awsConfig.clientId,
        Username: email,
        ConfirmationCode: code,
      }),
    )
    return { ok: true }
  } catch (e) {
    return { error: errStr(e) }
  }
}

export async function resendCode(email) {
  if (!isAuthConfigured) return { error: 'not-configured' }
  try {
    await client.send(
      new ResendConfirmationCodeCommand({ ClientId: awsConfig.clientId, Username: email }),
    )
    return { ok: true }
  } catch (e) {
    return { error: errStr(e) }
  }
}

export async function signIn({ email, password }) {
  if (!isAuthConfigured) return { error: 'not-configured' }
  try {
    const r = await client.send(
      new InitiateAuthCommand({
        ClientId: awsConfig.clientId,
        AuthFlow: 'USER_PASSWORD_AUTH',
        AuthParameters: { USERNAME: email, PASSWORD: password },
      }),
    )
    // 관리자가 초대한 계정은 임시 비밀번호로 첫 로그인 시 새 비밀번호를 요구한다.
    // 토큰이 아직 없으므로 Session 을 넘겨 completeNewPassword 로 이어받는다.
    if (r.ChallengeName === 'NEW_PASSWORD_REQUIRED') {
      return { challenge: 'NEW_PASSWORD_REQUIRED', session: r.Session }
    }
    const a = r.AuthenticationResult
    if (!a?.IdToken)
      return { error: `NotAuthorizedException: unexpected challenge ${r.ChallengeName || ''}` }
    saveTokens({ idToken: a.IdToken, accessToken: a.AccessToken, refreshToken: a.RefreshToken })
    const user = claimsToUser(decode(a.IdToken))
    emit(user)
    return { ok: true, user }
  } catch (e) {
    return { error: errStr(e) }
  }
}

// 임시 비밀번호 첫 로그인 마무리 — 새 비밀번호를 설정하면서 로그인까지 완료한다.
// signIn 이 돌려준 session 을 그대로 넘겨야 한다(수 분 내 만료).
export async function completeNewPassword({ email, password, session }) {
  if (!isAuthConfigured) return { error: 'not-configured' }
  try {
    const r = await client.send(
      new RespondToAuthChallengeCommand({
        ClientId: awsConfig.clientId,
        ChallengeName: 'NEW_PASSWORD_REQUIRED',
        Session: session,
        ChallengeResponses: { USERNAME: email, NEW_PASSWORD: password },
      }),
    )
    const a = r.AuthenticationResult
    if (!a?.IdToken)
      return { error: `NotAuthorizedException: unexpected challenge ${r.ChallengeName || ''}` }
    saveTokens({ idToken: a.IdToken, accessToken: a.AccessToken, refreshToken: a.RefreshToken })
    const user = claimsToUser(decode(a.IdToken))
    emit(user)
    return { ok: true, user }
  } catch (e) {
    return { error: errStr(e) }
  }
}

export async function signOut() {
  const tokens = loadTokens()
  clearTokens()
  emit(null)
  if (tokens?.accessToken) {
    try {
      await client.send(new GlobalSignOutCommand({ AccessToken: tokens.accessToken }))
    } catch {
      // 이미 만료된 토큰이어도 로컬 로그아웃은 완료된 상태
    }
  }
  return { ok: true }
}

// 비밀번호 재설정 코드 발송
export async function forgotPassword(email) {
  if (!isAuthConfigured) return { error: 'not-configured' }
  try {
    await client.send(new ForgotPasswordCommand({ ClientId: awsConfig.clientId, Username: email }))
    return { ok: true }
  } catch (e) {
    return { error: errStr(e) }
  }
}

// 재설정 코드 + 새 비밀번호 확정
export async function confirmForgotPassword({ email, code, password }) {
  if (!isAuthConfigured) return { error: 'not-configured' }
  try {
    await client.send(
      new ConfirmForgotPasswordCommand({
        ClientId: awsConfig.clientId,
        Username: email,
        ConfirmationCode: code,
        Password: password,
      }),
    )
    return { ok: true }
  } catch (e) {
    return { error: errStr(e) }
  }
}
