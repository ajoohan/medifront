// PPT(.pptx) → 메디프론트 스타일 자료로 변환
//
// PPTX 는 XML 이 든 ZIP 이다. 슬라이드마다 제목·본문·이미지를 뽑아
// 메디프론트 서식의 HTML 로 다시 조판한다.
//
// ⚠️ 원본 레이아웃을 그대로 옮기는 것이 아니다. 도형 위치·표·차트·애니메이션은
// PowerPoint 고유의 표현이라 웹으로 1:1 재현이 되지 않는다. 이 변환기는 내용을
// 가져와 메디프론트 서식으로 '다시 조판'한다 — 글꼴·색·여백이 사이트와 같아지고,
// 원본의 자리 배치는 사라진다.
import JSZip from 'jszip'

// DynamoDB 한 항목의 한계는 400KB 다. 여유를 두고 이 선에서 멈춘다.
const MAX_CONTENT_BYTES = 300 * 1024
// 이미지 한 장의 상한 — 여러 장이 들어가도 전체가 넘치지 않도록 작게 잡는다
const MAX_IMAGE_BYTES = 90 * 1024

const decodeXml = (s) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')

const escapeHtml = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  )

// 한 문단(<a:p>)의 글자들을 이어 붙인다
const paragraphText = (p) =>
  decodeXml([...p.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((m) => m[1]).join(''))
    .replace(/\s+/g, ' ')
    .trim()

// 슬라이드 XML 하나에서 문단을 순서대로 뽑는다.
// 제목 개체틀(ph type="title")이 있으면 그 글을 앞으로 보낸다 — 실무 파일에는
// 개체틀 없이 그냥 텍스트 상자로 만든 장표가 많아, 없을 때를 기준으로 설계한다.
function readParagraphs(xml) {
  const shapes = [...xml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].map((m) => m[0])
  const titled = []
  const rest = []
  for (const sp of shapes) {
    const paras = [...sp.matchAll(/<a:p>[\s\S]*?<\/a:p>/g)]
      .map((m) => paragraphText(m[0]))
      .filter(Boolean)
    if (!paras.length) continue
    if (/<p:ph[^>]*type="(title|ctrTitle)"/.test(sp)) titled.push(...paras)
    else rest.push(...paras)
  }
  return [...titled, ...rest]
}

// 앞머리에 붙은 장 번호("03" 같은 한두 자리 숫자)는 제목이 아니라 구획 표시다.
const NUMBER_LABEL = /^\d{1,2}$/

// 문단 목록 → { kicker, title, lines }
function shapeSlide(lines) {
  const list = [...lines]
  let kicker = ''
  while (list.length && NUMBER_LABEL.test(list[0])) kicker = list.shift()
  const title = list.shift() || ''
  return { kicker, title, lines: list }
}

// 슬라이드가 참조하는 그림 파일 경로 (ppt/media/…)
function readSlideImages(relsXml) {
  if (!relsXml) return []
  return [...relsXml.matchAll(/Target="([^"]*media\/[^"]+)"/g)].map((m) =>
    m[1].replace(/^\.\.\//, 'ppt/'),
  )
}

// 그림을 줄여 dataURL 로. 큰 사진이 그대로 들어가면 저장 한계를 넘는다.
async function toCompressedDataUrl(blob) {
  const bitmap = await createImageBitmap(blob)
  let width = Math.min(bitmap.width, 1280)
  let quality = 0.82
  for (let i = 0; i < 8; i++) {
    const height = Math.round((bitmap.height * width) / bitmap.width)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height)
    const out = canvas.toDataURL('image/jpeg', quality)
    const bytes = (out.length - out.indexOf(',') - 1) * 0.75
    if (bytes < MAX_IMAGE_BYTES) return out
    if (quality > 0.5) quality -= 0.12
    else width = Math.round(width * 0.75)
  }
  return null // 끝까지 못 줄이면 넣지 않는다
}

// 슬라이드 순서 — presentation.xml 의 목록을 따르고, 못 읽으면 파일명 번호순
function slideOrder(zip) {
  const names = Object.keys(zip.files).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
  return names.sort((a, b) => Number(a.match(/(\d+)/)[1]) - Number(b.match(/(\d+)/)[1]))
}

// 뽑아낸 슬라이드를 메디프론트 서식 HTML 로 조판
function buildHtml(slides) {
  return slides
    .map((s, i) => {
      const num = s.kicker || String(i + 1).padStart(2, '0')
      const body = s.lines.length
        ? `<ul>${s.lines.map((l) => `<li>${escapeHtml(l)}</li>`).join('')}</ul>`
        : ''
      const pics = s.images.map((src) => `<img src="${src}" alt="" />`).join('')
      return [
        `<section class="deck-slide">`,
        `<span class="deck-slide__num">${escapeHtml(num)}</span>`,
        s.title ? `<h3>${escapeHtml(s.title)}</h3>` : '',
        body,
        pics,
        `</section>`,
      ].join('')
    })
    .join('')
}

// 변환 결과: { ok, html, slideCount, title, dropped, bytes } 또는 { error }
export async function pptxToDeck(file) {
  let zip
  try {
    zip = await JSZip.loadAsync(file)
  } catch {
    return { error: 'PPT 파일을 열지 못했습니다. .pptx 형식인지 확인해 주세요.' }
  }

  const names = slideOrder(zip)
  if (!names.length) {
    return { error: '슬라이드를 찾지 못했습니다. .ppt(구형)라면 .pptx 로 저장해 주세요.' }
  }

  // 1) 먼저 모든 장의 문단을 읽는다
  const pages = []
  for (const name of names) {
    const xml = await zip.file(name).async('string')
    pages.push({ name, paras: readParagraphs(xml) })
  }

  // 2) 대부분의 장에 똑같이 나오는 줄은 머리글·꼬리글(로고, 회사명 등)이다.
  //    내용이 아니므로 걷어낸다 — 그러지 않으면 모든 장의 제목이 같아진다.
  const seen = {}
  pages.forEach((p) => new Set(p.paras).forEach((l) => (seen[l] = (seen[l] || 0) + 1)))
  const chrome = new Set(
    Object.entries(seen)
      .filter(([, c]) => pages.length >= 3 && c >= pages.length * 0.6)
      .map(([l]) => l),
  )

  // 3) 장마다 제목·본문·그림을 정리한다
  const slides = []
  let dropped = 0 // 크기 때문에 넣지 못한 그림 수

  for (const page of pages) {
    const { kicker, title, lines } = shapeSlide(page.paras.filter((l) => !chrome.has(l)))

    const relsName = page.name.replace('ppt/slides/', 'ppt/slides/_rels/') + '.rels'
    const relsFile = zip.file(relsName)
    const relsXml = relsFile ? await relsFile.async('string') : ''

    const images = []
    for (const path of readSlideImages(relsXml)) {
      const f = zip.file(path)
      if (!f) continue
      try {
        const url = await toCompressedDataUrl(await f.async('blob'))
        if (url) images.push(url)
        else dropped += 1
      } catch {
        dropped += 1
      }
    }
    slides.push({ kicker, title, lines, images })
  }

  // 저장 한계를 넘으면 뒤쪽 그림부터 덜어낸다 — 글은 모두 남긴다
  let html = buildHtml(slides)
  while (html.length > MAX_CONTENT_BYTES) {
    const withPic = [...slides].reverse().find((s) => s.images.length)
    if (!withPic) break
    withPic.images.pop()
    dropped += 1
    html = buildHtml(slides)
  }

  return {
    ok: true,
    html,
    slideCount: slides.length,
    // 첫 슬라이드 제목을 자료 제목 기본값으로 제안한다
    title: slides.find((s) => s.title)?.title || '',
    dropped,
    bytes: html.length,
  }
}

export const pptxLimits = { MAX_CONTENT_BYTES, MAX_IMAGE_BYTES }
