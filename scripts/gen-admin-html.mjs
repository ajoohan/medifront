// ─────────────────────────────────────────────────────────
// 빌드 후 실행: dist/index.html 을 복제해 /admin 전용 OG 메타로 치환한
// dist/admin (확장자 없는 S3 오브젝트) 를 생성한다.
//
// 정적 SPA(S3+CloudFront)는 크롤러에 라우트별 메타를 줄 수 없으므로,
// /admin 경로에 실제 오브젝트("admin")를 두어 SNS 공유 카드를 홈페이지와
// 별도로 노출한다. 이 파일도 index.html 과 동일한 번들을 로드하므로
// 실제 사용자가 /admin 을 직접 열면 React 라우터가 관리자 화면을 렌더한다.
//
// 배포 스크립트에서 반드시 Content-Type: text/html 로 업로드해야 한다.
// (deploy-aws.sh 참고)
// ─────────────────────────────────────────────────────────
import { readFileSync, writeFileSync } from 'node:fs'

const SRC = 'dist/index.html'
const OUT = 'dist/admin'

let html = readFileSync(SRC, 'utf8')

// (from, to, 필수여부) — 값 기반 치환이라 태그 포맷/공백에 영향받지 않음
const REPLACEMENTS = [
  // og:title / twitter:title 공통 문구
  ['메디프론트 | 병원 컨설팅 파트너', '메디프론트 MEDIFRONT', true],
  // og:description / twitter:description 공통 문구
  [
    '데이터와 AI로 증명하는 병원 성장. 전국 원장님들이 선택한 병원 컨설팅 파트너, 메디프론트.',
    '메디프론트 | 관리자 화면',
    true,
  ],
  // 공유 이미지 → 진한 그레이 관리자 카드
  ['https://medifront.co.kr/og-image.png?v=3', 'https://medifront.co.kr/og-admin.png?v=2', true],
  // 정규 URL
  ['content="https://medifront.co.kr/"', 'content="https://medifront.co.kr/admin"', true],
  // og:image:alt
  ['메디프론트 - 원장님의 든든한 병·의원 컨설팅 파트너', '메디프론트 관리자 화면', false],
  // 브라우저 탭 제목
  [
    '<title>메디프론트 MEDIFRONT | 병원 성장의 모든 것, 병원 컨설팅 파트너</title>',
    '<title>메디프론트 MEDIFRONT | 관리자 화면</title>',
    true,
  ],
]

for (const [from, to, required] of REPLACEMENTS) {
  if (!html.includes(from)) {
    const msg = `[gen-admin-html] 치환 문자열을 찾지 못함: "${from}"`
    if (required) throw new Error(msg + ' — index.html 메타 문구가 바뀌었는지 확인하세요.')
    console.warn(msg + ' (선택 항목이라 건너뜀)')
    continue
  }
  html = html.split(from).join(to)
}

writeFileSync(OUT, html)
console.log(`[gen-admin-html] WROTE ${OUT} (${html.length} bytes)`)
