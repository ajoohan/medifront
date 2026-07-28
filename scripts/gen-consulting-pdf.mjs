// 컨설팅 자료(HTML 덱) → PDF 생성
//
//   node scripts/gen-consulting-pdf.mjs
//
// PC용·모바일용을 각각 만든다. 덱은 스크롤 방식이라 인쇄용 CSS가 따로 없으므로,
// 임시 사본에 @page 와 슬라이드 분할 규칙을 주입한 뒤 헤드리스 크롬으로 뽑는다.
// (원본 HTML 은 건드리지 않는다)
//
// 페이지 크기는 실제 슬라이드 높이를 재서 정한 값이다 —
// 이보다 작으면 내용이 잘리고, 크면 아래가 비어 다음 장으로 밀린다.
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { resolve, join } from 'node:path'
import { pathToFileURL } from 'node:url'

const ROOT = resolve(import.meta.dirname, '..')
const OUT_DIR = join(ROOT, 'public', 'docs')
const TMP_DIR = join(ROOT, 'node_modules', '.cache', 'consulting-pdf')

const DECKS = ['consulting_1', 'consulting_2']
const VARIANTS = {
  pc: { width: 1280, height: 960 },
  mobile: { width: 430, height: 1300 },
}

// 크롬 실행 파일 — 설치 위치가 다르면 CHROME 환경변수로 지정한다
const CHROME_CANDIDATES = [
  process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
].filter(Boolean)

const chrome = CHROME_CANDIDATES.find((p) => existsSync(p))
if (!chrome) {
  console.error('크롬을 찾지 못했습니다. CHROME 환경변수로 실행 파일 경로를 지정하세요.')
  process.exit(1)
}

// 인쇄용 오버라이드 — 화면 전용 요소를 감추고 슬라이드마다 페이지를 나눈다
const printCss = ({ width, height }) => `
<style id="pdf-overrides">
  @page { size: ${width}px ${height}px; margin: 0; }
  html, body { width: ${width}px !important; margin: 0 !important; }
  /* 스크롤 진행바·카운터는 화면 전용 */
  .progress-bar, .slide-counter, .scroll-hint { display: none !important; }
  /* 스크롤 등장 애니메이션이 인쇄 시 '안 보이는 상태'로 굳는 것을 막는다 */
  .slide, .a-up, .reveal, [class*='inview'] {
    opacity: 1 !important;
    transform: none !important;
    animation: none !important;
    transition: none !important;
  }
  .slide {
    width: ${width}px !important;
    min-height: ${height}px !important;
    height: ${height}px !important;
    break-after: page;
    page-break-after: always;
    overflow: hidden !important;
  }
  .slide:last-child { break-after: auto; page-break-after: auto; }
</style>
`

mkdirSync(OUT_DIR, { recursive: true })
mkdirSync(TMP_DIR, { recursive: true })

let made = 0
for (const deck of DECKS) {
  const src = join(ROOT, 'public', `${deck}.html`)
  const html = readFileSync(src, 'utf8')

  for (const [variant, size] of Object.entries(VARIANTS)) {
    // </head> 직전에 오버라이드를 끼워 넣어 기존 규칙을 이긴다
    const patched = html.replace('</head>', `${printCss(size)}</head>`)
    const tmp = join(TMP_DIR, `${deck}_${variant}.html`)
    writeFileSync(tmp, patched, 'utf8')

    const out = join(OUT_DIR, `${deck}_${variant}.pdf`)
    execFileSync(
      chrome,
      [
        '--headless=new',
        '--disable-gpu',
        '--no-sandbox',
        '--run-all-compositor-stages-before-draw',
        '--virtual-time-budget=10000',
        `--window-size=${size.width},${size.height}`,
        '--no-pdf-header-footer',
        `--print-to-pdf=${out}`,
        pathToFileURL(tmp).href,
      ],
      { stdio: 'pipe' },
    )
    console.log(`[pdf] ${deck}_${variant}.pdf`)
    made += 1
  }
}

rmSync(TMP_DIR, { recursive: true, force: true })
console.log(`완료 — PDF ${made}개를 public/docs/ 에 생성했습니다.`)
