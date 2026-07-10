// MEDIFRONT 공식 로고 (public/logo-*.png 원본 이미지 사용)
//   variant="light" → 흰색 로고 (어두운 배경: 헤더·푸터)
//   variant="dark"  → 검정 로고 (밝은 배경: 로그인 팝업 등)
export default function Logo({ variant = 'light', className = '' }) {
  const src = variant === 'light' ? '/logo-light.png' : '/logo-dark.png'
  return <img className={`logo-img ${className}`} src={src} alt="메디프론트 MEDIFRONT" />
}
