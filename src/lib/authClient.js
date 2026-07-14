// Cognito 인증 클라이언트 (기존 Supabase Auth 대체)
// 토큰은 localStorage 에 보관하고, 만료 시 refresh token 으로 자동 갱신한다.
import {
  CognitoIdentityProviderClient,
  SignUpCommand,
  ConfirmSignUpCommand,
  ResendConfirmationCodeCommand,
  InitiateAuthCommand,
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

function claimsToUser(claims) {
  if (!claims?.email) return null
  return {
    email: claims.email,
    name: claims.name || claims.email.split('@')[0],
    phone: claims['custom:phone'] || '-',
    grade: claims['custom:grade'] || '일반',
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

export async function getSession() {
  const tokens = loadTokens()
  if (!tokens?.idToken) return null
  const claims = decode(tokens.idToken)
  // 만료 1분 전부터는 갱신 시도
  if (claims?.exp && claims.exp * 1000 > Date.now() + 60_000) return claimsToUser(claims)
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
    return claimsToUser(decode(a.IdToken))
  } catch {
    clearTokens()
    return null
  }
}

// ── 가입/로그인/복구 ──

export async function signUp({ email, password, name, phone, grade }) {
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
          { Name: 'custom:grade', Value: grade || '일반' },
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
    const a = r.AuthenticationResult
    if (!a?.IdToken) return { error: 'NotAuthorizedException: unexpected challenge' }
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
