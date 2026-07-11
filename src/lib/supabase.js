// Supabase 인증 클라이언트
// .env 에 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 를 설정하면 실제 인증이 활성화되고,
// 없으면 null → 사이트는 데모 로그인 모드로 동작합니다.
// (anon key는 프론트 공개용으로 설계된 키라 노출되어도 됩니다)
import { createClient } from '@supabase/supabase-js'

const url = (import.meta.env.VITE_SUPABASE_URL || '').trim()
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim()

// 환경변수 오염 감지 — 마스킹 문자(•)·한글·공백 등이 섞이면 모든 인증 요청이
// "String contains non ISO-8859-1 code point" 오류로 실패하므로 미리 걸러낸다.
const keyValid = /^[A-Za-z0-9._-]+$/.test(anonKey)
if (anonKey && !keyValid) {
  console.error(
    '[supabase] VITE_SUPABASE_ANON_KEY 에 잘못된 문자가 포함되어 있습니다. ' +
      'Vercel > Settings > Environment Variables 에서 키 전체를 다시 붙여넣고 재배포하세요.',
  )
}

export const supabase = url && anonKey && keyValid ? createClient(url, anonKey) : null
export const isSupabaseConfigured = !!supabase
// 환경변수가 있으나 값이 손상된 상태 — 화면에서 명확한 안내를 띄우기 위한 플래그
export const isSupabaseMisconfigured = !!anonKey && !keyValid
