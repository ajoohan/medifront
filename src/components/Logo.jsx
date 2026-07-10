// MEDIFRONT 워드마크 — 사이트 폰트(Pretendard)를 사용해 벡터처럼 선명하게 렌더링.
// 원본 로고(검정+틸)를 웹 배경에 맞춰 재현. variant로 명암 배경 대응.
//   variant="light" → 어두운 배경용(흰 글자)
//   variant="dark"  → 밝은 배경용(차콜 글자)
// 크로스(+)는 항상 브랜드 틸 컬러.

function Cross() {
  // 공식 로고의 크로스: 우하단만 라운드 처리된 플러스 (파비콘과 동일 형태)
  return (
    <span className="logo__cross" aria-hidden="true">
      <svg viewBox="0 0 512 512" fill="currentColor" width="100%" height="100%">
        <path d="M216 106 H298 V216 H404 V298 H298 V342 A82 82 0 0 1 216 424 V298 H106 V216 H216 Z" />
      </svg>
    </span>
  )
}

export default function Logo({ variant = 'light', className = '' }) {
  return (
    <span
      className={`logo logo--${variant} ${className}`}
      role="img"
      aria-label="메디프론트 MEDIFRONT"
    >
      <span className="logo__row logo__row--1">
        <span>ME</span>
        <Cross />
        <span>DI</span>
      </span>
      <span className="logo__row logo__row--2">FRONT</span>
    </span>
  )
}
