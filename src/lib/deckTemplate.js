// 메디프론트 덱 조판 — 구조화된 장표를 실제 자료와 같은 서식의 슬라이드로 만든다.
//
// '개원컨설팅 프로세스', '건강 경험 솔루션' 자료와 같은 마크업·클래스를 쓴다.
// 저장할 때는 슬라이드 마크업만 남기고, 볼 때 DECK_CSS 를 입혀 iframe 에 띄운다 —
// 서식을 고치면 이미 등록된 자료에도 함께 반영된다.
import { DECK_CSS } from './deckShellCss'

// 이 표시로 시작하는 자료는 '덱'이다. 에디터로 쓴 글과 구분하려고 쓴다
// (백엔드에 종류를 담는 칸이 없어, 내용의 첫머리로 판별한다).
export const DECK_MARKER = '<div class="slide-deck">'
export const isDeck = (html) => typeof html === 'string' && html.startsWith(DECK_MARKER)

const esc = (s) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  )

// 긴 제목은 중간에서 줄을 바꿔 준다 — 한 줄로 흐르면 표지가 답답해 보인다
function breakTitle(text) {
  const t = String(text || '').trim()
  if (t.length < 14) return esc(t)
  const mid = Math.floor(t.length / 2)
  const at = t.lastIndexOf(' ', mid)
  if (at < 4 || at > t.length - 4) return esc(t)
  return `${esc(t.slice(0, at))}<br>${esc(t.slice(at + 1))}`
}

const brandbar = (tag) =>
  `<div class="brandbar"><a class="logo" href="https://medifront.co.kr" target="_blank" rel="noreferrer" onclick="event.stopPropagation()">` +
  `<img class="on-light" src="/logo-1line-dark.svg" alt="MEDIFRONT" />` +
  `<img class="on-dark" src="/logo-1line-light.svg" alt="MEDIFRONT" /></a>` +
  `<div class="tag">${esc(tag || '')}</div></div>`

const pagenum = (i, total) =>
  `<div class="pagenum">${String(i + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}</div>`

// 항목 개수에 맞는 격자 — 4개까지는 한 줄, 그 이상은 3열로 접는다
const gridClass = (n) => (n <= 2 ? 'g2' : n === 4 ? 'g4' : 'g3')

// ── 유형별 본문 ──────────────────────────────────────────────
// items 의 뜻은 유형마다 다르다: cards 는 {title, desc}, metrics 는 {value, label},
// timeline 은 {label, desc}, list 는 {title, desc}.

const bodyCover = (s) =>
  `<div class="a-up" style="max-width:900px">` +
  (s.kicker ? `<div class="kicker">${esc(s.kicker)}</div>` : '') +
  `<h1 class="h-xl">${breakTitle(s.title)}</h1>` +
  `<div class="rule"></div>` +
  (s.lead ? `<p class="lead">${esc(s.lead)}</p>` : '') +
  `<p style="margin-top:44px;font-size:13px;letter-spacing:.2em;color:rgba(250,248,244,.55)">WWW.MEDIFRONT.CO.KR</p>` +
  `</div>`

const bodySection = (s) =>
  `<div class="a-up" style="max-width:820px">` +
  (s.kicker ? `<div class="kicker">${esc(s.kicker)}</div>` : '') +
  `<h2 class="h-xl">${breakTitle(s.title)}</h2>` +
  `<div class="rule"></div>` +
  (s.lead ? `<p class="lead">${esc(s.lead)}</p>` : '') +
  `</div>`

const heading = (s) =>
  (s.kicker ? `<div class="kicker a-up">${esc(s.kicker)}</div>` : '') +
  `<h2 class="h-lg a-up" style="margin-bottom:${s.lead ? 18 : 34}px">${breakTitle(s.title)}</h2>` +
  (s.lead
    ? `<p class="lead a-up" style="margin-bottom:34px;max-width:820px">${esc(s.lead)}</p>`
    : '')

const bodyCards = (s) =>
  heading(s) +
  `<div class="grid ${gridClass(s.items.length)} a-stagger">` +
  s.items
    .map(
      (it, n) =>
        `<div class="card bar"><div class="num">${String(n + 1).padStart(2, '0')}</div>` +
        `<h3>${esc(it.title)}</h3>` +
        (it.desc ? `<p>${esc(it.desc)}</p>` : '') +
        `</div>`,
    )
    .join('') +
  `</div>`

const bodyMetrics = (s) =>
  heading(s) +
  `<div class="grid ${gridClass(s.items.length)} a-stagger">` +
  s.items
    .map(
      (it) =>
        `<div class="metric"><div class="val">${esc(it.value || it.title)}</div>` +
        `<div class="lbl">${esc(it.label || it.desc || it.title)}</div></div>`,
    )
    .join('') +
  `</div>`

const bodyTimeline = (s) =>
  heading(s) +
  `<div class="tl a-stagger">` +
  s.items
    .map(
      (it, n) =>
        `<div class="tl-item"><div class="wk${n === s.items.length - 1 ? ' final' : ''}">` +
        `${esc(it.label || `STEP ${n + 1}`)}</div>` +
        `<p>${esc(it.desc || it.title)}</p></div>`,
    )
    .join('') +
  `</div>`

const bodyList = (s) =>
  heading(s) +
  `<div class="a-stagger" style="max-width:960px">` +
  s.items
    .map(
      (it) =>
        `<div class="checkline"><div class="ck">✓</div>` +
        `<p>${esc(it.title)}${it.desc ? `<small>${esc(it.desc)}</small>` : ''}</p></div>`,
    )
    .join('') +
  `</div>`

const bodyText = (s) =>
  heading(s) +
  s.items.map((it) => `<p class="lead a-up" style="max-width:900px">${esc(it.title)}</p>`).join('')

const LAYOUTS = {
  cover: { dark: true, body: bodyCover },
  section: { dark: true, body: bodySection },
  cards: { dark: false, body: bodyCards },
  metrics: { dark: false, body: bodyMetrics },
  timeline: { dark: false, body: bodyTimeline },
  list: { dark: false, body: bodyList },
  text: { dark: false, body: bodyText },
}

// 항목이 없으면 격자·타임라인 유형은 빈 화면이 된다 — 글만 있는 유형으로 낮춘다
function resolveLayout(s) {
  const name = LAYOUTS[s.layout] ? s.layout : 'cards'
  if (!s.items?.length && name !== 'cover' && name !== 'section') return 'text'
  return name
}

// 구조화된 장표 → 슬라이드 마크업
export function renderDeck(slides) {
  const total = slides.length
  const body = slides
    .map((raw, i) => {
      const s = { ...raw, items: Array.isArray(raw.items) ? raw.items : [] }
      const name = resolveLayout(s)
      const layout = LAYOUTS[name]
      // 유형을 낮췄으면 문단을 항목으로 옮겨 준다
      if (name === 'text' && !s.items.length && s.lead) {
        s.items = [{ title: s.lead }]
        s.lead = ''
      }
      return (
        `<div class="slide${layout.dark ? ' dark' : ''}">` +
        brandbar(s.tag || 'MEDIFRONT') +
        layout.body(s) +
        (name === 'cover' ? '' : pagenum(i, total)) +
        (name === 'cover'
          ? `<div class="pagenum">01 / ${String(total).padStart(2, '0')}</div>`
          : '') +
        `</div>`
      )
    })
    .join('\n')
  return `${DECK_MARKER}\n${body}\n</div>`
}

// 슬라이드가 화면에 들어오면 애니메이션을 켜고, 아래쪽에 진행바·이동 버튼을 둔다.
// 원본 덱과 같은 동작이다.
const DECK_SCRIPT = String.raw`
const slides = [...document.querySelectorAll('.slide')]
const io = new IntersectionObserver(
  (es) => es.forEach((e) => e.isIntersecting && e.target.classList.add('inview')),
  { threshold: 0.15 },
)
slides.forEach((s) => io.observe(s))

const bar = document.querySelector('.progress-bar')
const cur = document.getElementById('current')
const onScroll = () => {
  const h = document.body.scrollHeight - window.innerHeight
  if (bar) bar.style.width = (h > 0 ? (window.scrollY / h) * 100 : 0) + '%'
  const i = slides.findIndex((s) => s.getBoundingClientRect().bottom > window.innerHeight * 0.5)
  if (cur) cur.textContent = String((i < 0 ? slides.length : i + 1)).padStart(2, '0')
}
window.addEventListener('scroll', onScroll, { passive: true })
onScroll()

const go = (d) => {
  const i = slides.findIndex((s) => s.getBoundingClientRect().top > window.innerHeight * 0.1)
  const next = d > 0 ? (i < 0 ? slides.length - 1 : i) : Math.max(0, (i < 0 ? slides.length : i) - 2)
  slides[Math.min(Math.max(next, 0), slides.length - 1)]?.scrollIntoView({ behavior: 'smooth' })
}
window.prevSlide = () => go(-1)
window.nextSlide = () => go(1)
`

// 슬라이드 마크업 → iframe 에 띄울 완성된 문서
export function deckDocument(markup, title = '메디프론트 자료') {
  // `slide-deck` 은 슬라이드가 아니다 — 뒤에 공백이나 따옴표가 오는 것만 센다
  const total = (markup.match(/<div class="slide[ "]/g) || []).length
  return `<!DOCTYPE html>
<html lang="ko"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;900&display=swap" rel="stylesheet">
<style>${DECK_CSS}</style>
</head><body>
<div class="progress-bar" style="width:0"></div>
${markup}
<div class="nav-controls">
  <button class="nav-btn" onclick="prevSlide()">←</button>
  <span class="slide-counter"><span id="current">01</span> / ${String(total).padStart(2, '0')}</span>
  <button class="nav-btn" onclick="nextSlide()">→</button>
</div>
<script>${DECK_SCRIPT}${'</scr' + 'ipt>'}
</body></html>`
}
