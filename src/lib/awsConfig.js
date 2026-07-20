// AWS 백엔드 연결 설정 (Cognito 인증 + 데이터 API)
// scripts/deploy-backend.sh 를 실행하면 .env.production.local 에 값이 자동 기록된다.
// 환경변수가 없으면 아래 FALLBACK 값을 사용하므로, 최초 배포 후 실제 값을
// 채워 커밋해 두면 환경변수 없이도 동작한다. (모두 프론트 공개용 설계 값)
const FALLBACK = {
  region: 'ap-northeast-2',
  userPoolId: '', // 예: ap-northeast-2_XXXXXXXXX
  clientId: '', // 예: 1a2b3c4d5e6f7g8h9i0jklmnop
  apiBaseUrl: '', // 예: https://xxxxxxxxxx.execute-api.ap-northeast-2.amazonaws.com
  // 소셜 로그인(Hosted UI) 도메인 — backend/template.yaml 의 UserPoolDomain 과 같아야 한다
  authDomain: 'medifront-auth.auth.ap-northeast-2.amazoncognito.com',
  // 네이버 로그인 — developers.naver.com 애플리케이션의 Client ID (공개 값).
  // 비어 있으면 네이버 버튼이 표시되지 않는다. 시크릿은 백엔드(Lambda)에만 둔다.
  naverClientId: '',
}

const env = import.meta.env
const pick = (v, fb) => {
  const s = (v || '').trim()
  return s || fb
}

export const awsConfig = {
  region: pick(env.VITE_AWS_REGION, FALLBACK.region),
  userPoolId: pick(env.VITE_COGNITO_USER_POOL_ID, FALLBACK.userPoolId),
  clientId: pick(env.VITE_COGNITO_CLIENT_ID, FALLBACK.clientId),
  apiBaseUrl: pick(env.VITE_API_BASE_URL, FALLBACK.apiBaseUrl).replace(/\/+$/, ''),
  authDomain: pick(env.VITE_COGNITO_AUTH_DOMAIN, FALLBACK.authDomain),
  naverClientId: pick(env.VITE_NAVER_CLIENT_ID, FALLBACK.naverClientId),
}

// DB 모듈들의 방어 가드용 — 미설정이면 각 화면이 목업/브라우저 저장으로 폴백한다
export const isApiConfigured = !!awsConfig.apiBaseUrl
export const isAuthConfigured = !!(awsConfig.userPoolId && awsConfig.clientId)
