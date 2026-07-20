// 휴대폰 본인인증(실명인증) 클라이언트
//
// 흐름: 인증사 팝업으로 본인인증 → 인증 식별자(impUid)를 백엔드(/auth/verify-phone)로 보냄
//   → 백엔드가 인증사 서버에 직접 조회해 위조를 걸러내고 1회용 티켓을 발급
//   → 가입 완료 시 그 티켓을 함께 제출하면 '본인인증 완료' 회원으로 기록된다.
//
// 인증사 가맹점 코드(awsConfig.verifyMerchantCode)가 비어 있으면 기능 전체가 꺼진 것으로
// 동작한다 — 계약 전에도 가입은 지금까지처럼 정상 진행된다.
import { awsConfig } from './awsConfig'
import { apiSend } from './api'

// 계약 전이면 false — 화면에서 본인인증 단계를 아예 표시하지 않는다
export const isVerifyEnabled = () => !!awsConfig.verifyMerchantCode

const SDK_URL = 'https://cdn.iamport.kr/v1/iamport.js'
let sdkPromise = null

// 인증사 SDK 는 실제로 인증을 쓸 때만 내려받는다 (평소 페이지 로딩에 영향 없음)
function loadSdk() {
  if (window.IMP) return Promise.resolve(window.IMP)
  if (sdkPromise) return sdkPromise
  sdkPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = SDK_URL
    s.async = true
    s.onload = () => (window.IMP ? resolve(window.IMP) : reject(new Error('sdk-load-failed')))
    s.onerror = () => reject(new Error('sdk-load-failed'))
    document.head.appendChild(s)
  }).catch((e) => {
    sdkPromise = null // 다음 시도에서 다시 받을 수 있도록
    throw e
  })
  return sdkPromise
}

// 본인인증 실행 — 성공 시 { ok, ticket, name, phone }, 실패/취소 시 { error }
export async function verifyPhone() {
  if (!isVerifyEnabled()) return { error: 'verify-not-configured' }

  let IMP
  try {
    IMP = await loadSdk()
  } catch {
    return { error: 'verify-sdk-failed' }
  }
  IMP.init(awsConfig.verifyMerchantCode)

  // 인증사 팝업 — 사용자가 통신사·약관 동의를 거쳐 인증을 마치면 콜백이 온다
  const cert = await new Promise((resolve) => {
    IMP.certification(
      {
        // 요청 식별자 — 인증사 로그 대조용
        merchant_uid: `mf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        company: '메디프론트',
        popup: true,
      },
      resolve,
    )
  })
  if (!cert?.success) {
    // 사용자가 창을 닫거나 인증을 중단한 경우
    return { error: cert?.error_msg ? `verify-cancelled: ${cert.error_msg}` : 'verify-cancelled' }
  }

  // ⚠️ 팝업 결과만으로는 신뢰하지 않는다 — 서버가 인증사에 직접 조회해 확인한다
  const r = await apiSend('POST', '/auth/verify-phone', { impUid: cert.imp_uid })
  if (r.error) return { error: r.error }
  return { ok: true, ticket: r.data.ticket, name: r.data.name, phone: r.data.phone }
}
