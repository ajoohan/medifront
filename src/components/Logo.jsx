// MEDIFRONT 워드마크 — 사이트 폰트(Pretendard)를 사용해 벡터처럼 선명하게 렌더링.
// 원본 로고(검정+틸)를 웹 배경에 맞춰 재현. variant로 명암 배경 대응.
//   variant="light" → 어두운 배경용(흰 글자)
//   variant="dark"  → 밝은 배경용(차콜 글자)
// 크로스(+)는 항상 브랜드 틸 컬러.

function Cross() {
  return (
    <span className="logo__cross" aria-hidden="true">
      <svg viewBox="0 0 32 32" fill="currentColor" width="100%" height="100%">
        <path d="M13 2.5h6A1.8 1.8 0 0 1 20.8 4.3V11.2H27.7A1.8 1.8 0 0 1 29.5 13v6a1.8 1.8 0 0 1-1.8 1.8H20.8V27.7A1.8 1.8 0 0 1 19 29.5h-6a1.8 1.8 0 0 1-1.8-1.8V20.8H4.3A1.8 1.8 0 0 1 2.5 19v-6A1.8 1.8 0 0 1 4.3 11.2H11.2V4.3A1.8 1.8 0 0 1 13 2.5Z" />
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
