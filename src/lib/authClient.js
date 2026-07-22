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
export async function signUp({ email, password, name, phone, licenseNo, birth, verifyTicket }) {
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
          // 보건복지부 면허 조회에 필요(YYMMDD) — 의사 회원 신청 시에만
          ...(birth ? [{ Name: 'custom:birth', Value: birth }] : []),
          // 휴대폰 본인인증 티켓 — 가입 확정(postConfirmation) 시 서버가 검증·폐기한다
          ...(verifyTicket ? [{ Name: 'custom:verify_ticket', Value: verifyTicket }] : []),
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

// ── 구글 소셜 로그인 (Cognito Hosted UI + OAuth code + PKCE) ──
// 시크릿 없는 SPA 이므로 PKCE 로 코드 탈취를 방어하고, state 로 CSRF 를 방어한다.
const PKCE_KEY = 'medifront_oauth_pkce'

const b64url = (buf) =>
  btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

// 콜백 주소 — backend/template.yaml 의 CallbackURLs 와 정확히 일치해야 한다
const oauthRedirectUri = () => window.location.origin + '/'

// 구글 로그인 시작: Hosted UI 로 이동한다 (성공 시 ?code= 를 들고 사이트로 복귀)
export async function signInWithGoogle() {
  if (!isAuthConfigured || !awsConfig.authDomain) return { error: 'not-configured' }
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(32)))
  const state = b64url(crypto.getRandomValues(new Uint8Array(16)))
  sessionStorage.setItem(PKCE_KEY, JSON.stringify({ verifier, state }))
  const challenge = b64url(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)),
  )
  const p = new URLSearchParams({
    client_id: awsConfig.clientId,
    response_type: 'code',
    scope: 'openid email profile',
    redirect_uri: oauthRedirectUri(),
    identity_provider: 'Google',
    state,
    code_challenge_method: 'S256',
    code_challenge: challenge,
  })
  window.location.assign(`https://${awsConfig.authDomain}/oauth2/authorize?${p}`)
  return { ok: true }
}

// ── 네이버 로그인 — 네이버 인증 후 백엔드(/auth/naver)가 코드를 교환해 Cognito 토큰 발급 ──
// (네이버는 Cognito 미지원이라 Hosted UI 를 거치지 않는다. state 로 CSRF 를 방어하고,
//  시크릿이 필요한 코드 교환은 전부 백엔드에서 수행한다)
const NAVER_KEY = 'medifront_oauth_naver'

export async function signInWithNaver() {
  if (!awsConfig.naverClientId || !awsConfig.apiBaseUrl) return { error: 'not-configured' }
  const state = b64url(crypto.getRandomValues(new Uint8Array(16)))
  sessionStorage.setItem(NAVER_KEY, JSON.stringify({ state }))
  const p = new URLSearchParams({
    response_type: 'code',
    client_id: awsConfig.naverClientId,
    redirect_uri: oauthRedirectUri(),
    state,
  })
  window.location.assign(`https://nid.naver.com/oauth2.0/authorize?${p}`)
  return { ok: true }
}

// 소셜 로그인 복귀(?code=) 처리 — 앱 부팅 시 1회 호출(UserContext).
// 구글(Cognito Hosted UI)과 네이버(백엔드 교환) 콜백이 모두 사이트 루트로 돌아오므로,
// 어느 쪽이 시작한 요청인지는 저장해 둔 state 로 구분한다.
// 토큰 교환에 성공하면 일반 로그인과 동일하게 토큰을 저장하고 사용자를 반환한다.
export async function completeOAuthRedirect() {
  const url = new URL(window.location.href)
  const code = url.searchParams.get('code')
  const errParam = url.searchParams.get('error')
  if (!code && !errParam) return null
  const readSaved = (key) => {
    try {
      return JSON.parse(sessionStorage.getItem(key))
    } catch {
      return null
    }
  }
  const googleSaved = readSaved(PKCE_KEY)
  const naverSaved = readSaved(NAVER_KEY)
  sessionStorage.removeItem(PKCE_KEY)
  sessionStorage.removeItem(NAVER_KEY)
  const state = url.searchParams.get('state')
  const provider =
    naverSaved && state === naverSaved.state
      ? 'naver'
      : googleSaved && state === googleSaved.state
        ? 'google'
        : null
  // 우리가 시작한 요청(state 일치)이 아니면 무시한다 — CSRF/코드 주입 방어
  if (!provider) return null
  // 주소창의 code/state 는 즉시 지운다 (새로고침 시 재교환 시도·기록 노출 방지)
  url.searchParams.delete('code')
  url.searchParams.delete('state')
  url.searchParams.delete('error')
  url.searchParams.delete('error_description')
  const qs = url.searchParams.toString()
  window.history.replaceState({}, '', url.pathname + (qs ? `?${qs}` : '') + url.hash)
  if (errParam) return null // 사용자가 인증 화면에서 취소한 경우 등

  try {
    if (provider === 'naver') {
      // 백엔드가 네이버와 코드를 교환하고 Cognito 토큰을 발급한다
      const r = await fetch(`${awsConfig.apiBaseUrl}/auth/naver`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code, state }),
      })
      if (!r.ok) {
        // 실패 사유를 화면에 알릴 수 있게 돌려준다 (조용히 메인으로 떨어지지 않도록)
        const data = await r.json().catch(() => ({}))
        return { error: data.error || `naver-http-${r.status}` }
      }
      const t = await r.json()
      saveTokens({ idToken: t.idToken, accessToken: t.accessToken, refreshToken: t.refreshToken })
      const user = claimsToUser(decode(t.idToken))
      emit(user)
      return user
    }
    // 구글 — Cognito Hosted UI 토큰 교환 (PKCE)
    const r = await fetch(`https://${awsConfig.authDomain}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: awsConfig.clientId,
        code,
        redirect_uri: oauthRedirectUri(),
        code_verifier: googleSaved.verifier,
      }),
    })
    if (!r.ok) return { error: `google-http-${r.status}` }
    const t = await r.json()
    saveTokens({ idToken: t.id_token, accessToken: t.access_token, refreshToken: t.refresh_token })
    const user = claimsToUser(decode(t.id_token))
    emit(user)
    return user
  } catch {
    return { error: 'network' }
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
