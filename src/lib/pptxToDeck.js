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
import { renderDeck } from './deckTemplate'

// DynamoDB 한 항목의 한계는 400KB 다. 여유를 두고 이 선에서 멈춘다.
const MAX_CONTENT_BYTES = 300 * 1024

// 저장 크기는 UTF-8 바이트로 센다. 한글은 한 글자가 3바이트라
// 문자열 길이(html.length)로 재면 실제 크기를 크게 낮춰 본다.
const utf8Bytes = (s) => new TextEncoder().encode(s).length
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

// 뽑아낸 장표를 덱 서식의 구조로 옮긴다.
//
// AI 를 거치지 않아도 메디프론트 자료로 보여야 하므로, 규칙만으로 유형을 고른다.
// 첫 장은 표지, 나머지는 체크 목록 — 항목 수와 무관하게 안정적으로 보이는 형태다.
// (AI 를 거치면 장마다 어울리는 유형을 다시 고른다)
function toSpec(slides) {
  return slides.map((s, i) => {
    if (i === 0) {
      return {
        layout: 'cover',
        tag: 'MEDIFRONT',
        kicker: s.kicker || '',
        title: s.title || '메디프론트 자료',
        lead: s.lines[0] || '',
        items: [],
        images: s.images,
      }
    }
    return {
      layout: s.lines.length ? 'list' : 'section',
      tag: 'MEDIFRONT',
      kicker: s.kicker || '',
      title: s.title || '',
      lead: '',
      items: s.lines.map((l) => ({ title: l })),
      images: s.images,
    }
  })
}

const buildHtml = (slides) => renderDeck(toSpec(slides))

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

  // 저장 한계를 넘으면 뒤쪽 그림부터 덜어낸다 — 글은 모두 남긴다.
  // ⚠️ 글자 수가 아니라 UTF-8 바이트로 재야 한다. 한글은 한 글자가 3바이트라
  // 글자 수로 재면 실제 크기를 절반 이하로 잘못 본다.
  let html = buildHtml(slides)
  while (utf8Bytes(html) > MAX_CONTENT_BYTES) {
    const withPic = [...slides].reverse().find((s) => s.images.length)
    if (!withPic) break
    withPic.images.pop()
    dropped += 1
    html = buildHtml(slides)
  }

  const bytes = utf8Bytes(html)
  if (bytes > MAX_CONTENT_BYTES) {
    // 그림을 다 덜어내도 글만으로 한계를 넘는 경우 — 저장이 실패할 것이 확실하므로 미리 막는다
    return {
      error: `내용이 너무 많습니다(${Math.round(bytes / 1024)}KB). 한 자료는 ${Math.round(
        MAX_CONTENT_BYTES / 1024,
      )}KB 까지 저장됩니다. PPT를 나눠서 등록해 주세요.`,
    }
  }
  if (!html) {
    return { error: '슬라이드에서 글을 찾지 못했습니다. 이미지로만 된 PPT 는 등록할 수 없습니다.' }
  }

  return {
    ok: true,
    html,
    slideCount: slides.length,
    // 첫 슬라이드 제목을 자료 제목 기본값으로 제안한다
    title: slides.find((s) => s.title)?.title || '',
    dropped,
    bytes,
    // AI 로 다시 다듬을 때 쓸 원본 — 그림은 그대로 두고 글만 보낸다
    slides,
  }
}

// AI 가 고른 유형·문구를 원래 그림과 합쳐 다시 조판한다.
// 장 수가 다르면 앞에서부터 짝지어, AI 가 장을 합치거나 빠뜨려도 그림이 어긋나지 않게 한다.
export function applyFormatted(slides, formatted) {
  const spec = formatted.map((f, i) => {
    // 서버가 아직 옛 형식(points 배열)을 돌려줄 수 있다 — 화면만 먼저 배포된 동안에도
    // 결과가 비어 보이지 않게 항목으로 옮겨 준다.
    const items = Array.isArray(f.items)
      ? f.items
      : Array.isArray(f.points)
        ? f.points.map((p) => ({ title: p }))
        : []

    return {
      layout: f.layout || 'list',
      tag: String(f.tag || 'MEDIFRONT').trim() || 'MEDIFRONT',
      kicker: String(f.kicker || '').trim(),
      title: String(f.title || '').trim(),
      lead: String(f.lead || '').trim(),
      items: items
        .map((it) => ({
          title: String(it?.title || '').trim(),
          desc: String(it?.desc || '').trim(),
          value: String(it?.value || '').trim(),
          label: String(it?.label || '').trim(),
        }))
        .filter((it) => it.title || it.value),
      images: slides[i]?.images || [],
    }
  })

  // AI 응답이 원본보다 짧으면 남은 장은 규칙 기반 결과를 그대로 둔다 — 내용이 사라지지 않게
  if (spec.length < slides.length) spec.push(...toSpec(slides).slice(spec.length))

  const html = renderDeck(spec)
  return { html, bytes: utf8Bytes(html), slideCount: spec.length }
}

export const pptxLimits = { MAX_CONTENT_BYTES, MAX_IMAGE_BYTES }
