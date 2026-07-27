// MEDIFRONT 공식 로고 (public/logo-1line-*.svg 원본 벡터 사용 — 어떤 크기에서도 선명)
//   variant="light" → 흰색 로고 (어두운 배경: 헤더·푸터)
//   variant="dark"  → 검정 로고 (밝은 배경: 로그인 팝업·관리자 로그인 등)
export default function Logo({ variant = 'light', className = '' }) {
  const src = variant === 'light' ? '/logo-1line-light.svg' : '/logo-1line-dark.svg'
  return <img className={`logo-img ${className}`} src={src} alt="메디프론트 MEDIFRONT" />
}
