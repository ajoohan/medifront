// 덱 서식 CSS 를 원본 자료에서 다시 뽑아 src/lib/deckShellCss.js 를 갱신한다.
// PPT 로 만든 자료는 이 CSS 를 입혀 보여 주므로, 원본 덱의 디자인을 고쳤다면
// 이 스크립트를 돌려 둘을 맞춘다.
//   node scripts/sync-deck-css.mjs
import { readFileSync, writeFileSync } from 'node:fs'

const SOURCE = 'public/consulting_1.html'
const OUT = 'src/lib/deckShellCss.js'

const css = /<style>([\s\S]*?)<\/style>/.exec(readFileSync(SOURCE, 'utf8'))?.[1]?.trim()
if (!css) {
  console.error(`${SOURCE} 에서 <style> 을 찾지 못했습니다.`)
  process.exit(1)
}

const header = `// 메디프론트 덱 서식 (CSS)
//
// ${SOURCE} 의 <style> 을 그대로 옮긴 것이다. 손으로 베끼면
// 실제 자료와 조금씩 어긋나므로, 서식을 고칠 때는 원본 덱에서 다시 뽑는다:
//   node scripts/sync-deck-css.mjs
//
// PPT 로 만든 자료는 이 서식을 iframe 안에서 입혀 보여 준다 — 저장할 때는
// 슬라이드 마크업만 남기므로, 서식을 고치면 이미 등록된 자료에도 함께 반영된다.

export const DECK_CSS = String.raw\``

writeFileSync(OUT, `${header}${css}\n\`\n`)
console.log(`${OUT} 갱신 — CSS ${css.length}바이트`)
