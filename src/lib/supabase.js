// Supabase 인증 클라이언트
// .env 에 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 를 설정하면 실제 인증이 활성화되고,
// 없으면 null → 사이트는 데모 로그인 모드로 동작합니다.
// (anon key는 프론트 공개용으로 설계된 키라 노출되어도 됩니다)
import { createClient } from '@supabase/supabase-js'

// 기본값 — anon key는 클라이언트 번들에 원래 포함되는 공개 설계 키라 코드에 두어도 안전.
// 환경변수가 없거나 손상(마스킹 문자 등)된 경우 이 값으로 동작한다.
const FALLBACK_URL = 'https://ammzbaijoxoqzgbbwmuq.supabase.co'
const FALLBACK_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFtbXpiYWlqb3hvcXpnYmJ3bXVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2MzgxNzIsImV4cCI6MjA5OTIxNDE3Mn0.CScm8O9D-b9TzRon1EBs0gOXsavN0pSngH_wV2NNf5E'

const envUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim()
const envKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim()

// 환경변수 오염 감지 — 마스킹 문자(•)·한글·공백 등이 섞이면 모든 인증 요청이
// "String contains non ISO-8859-1 code point" 오류로 실패하므로 걸러내고 기본값으로 폴백.
const keyValid = /^[A-Za-z0-9._-]+$/.test(envKey)
if (envKey && !keyValid) {
  console.warn(
    '[supabase] VITE_SUPABASE_ANON_KEY 값이 손상되어 코드 내장 기본 키로 동작합니다. ' +
      'Vercel > Settings > Environment Variables 에서 키 전체를 다시 붙여넣는 것을 권장합니다.',
  )
}

const url = envUrl || FALLBACK_URL
const anonKey = envKey && keyValid ? envKey : FALLBACK_ANON_KEY

export const supabase = createClient(url, anonKey)
export const isSupabaseConfigured = true
// 환경변수가 있으나 값이 손상된 상태 (기본 키 폴백 중) — 화면 안내용 플래그
export const isSupabaseMisconfigured = !!envKey && !keyValid
