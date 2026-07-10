// Supabase 인증 클라이언트
// .env 에 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 를 설정하면 실제 인증이 활성화되고,
// 없으면 null → 사이트는 데모 로그인 모드로 동작합니다.
// (anon key는 프론트 공개용으로 설계된 키라 노출되어도 됩니다)
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = url && anonKey ? createClient(url, anonKey) : null
export const isSupabaseConfigured = !!supabase
