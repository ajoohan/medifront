// 메디프론트 덱 서식 (CSS)
//
// public/consulting_1.html 의 <style> 을 그대로 옮긴 것이다. 손으로 베끼면
// 실제 자료와 조금씩 어긋나므로, 서식을 고칠 때는 원본 덱에서 다시 뽑는다:
//   node scripts/sync-deck-css.mjs
//
// PPT 로 만든 자료는 이 서식을 iframe 안에서 입혀 보여 준다 — 저장할 때는
// 슬라이드 마크업만 남기므로, 서식을 고치면 이미 등록된 자료에도 함께 반영된다.

export const DECK_CSS = String.raw`:root{
  --green:#072E2B;        /* 사이트 테마 딥그린 (다크 슬라이드 배경) */
  --green-2:#0E453F;
  --teal:#149A87;         /* 텍스트 포인트 (로고 민트 계열, 가독 대비 확보) */
  --gold:#2CBFA9;         /* 로고 민트 틸 — 포인트 컬러 */
  --ivory:#FBFBFA;
  --ink:#221E1F;          /* 로고 차콜 블랙 */
  --muted:#5F6866;
  --line:rgba(34,30,31,.12);
  --font-head:'Noto Sans KR','Pretendard Variable',sans-serif;
  --font-body:'Pretendard Variable','Noto Sans KR',sans-serif;
}
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0B1211;color:var(--ink);font-family:var(--font-body)}
.slide-deck{position:relative;width:100%;max-width:1440px;margin:0 auto;box-shadow:0 0 80px rgba(0,0,0,.5)}
.slide{position:relative;width:100%;min-height:100vh;display:flex;flex-direction:column;justify-content:center;padding:120px 84px 90px;background:var(--ivory);overflow:hidden;border-bottom:1px solid rgba(0,0,0,.06)}
.slide.dark{background:var(--green);color:var(--ivory)}

/* ---------- 공통 타이포 ---------- */
h1,h2,h3{font-family:var(--font-head)}
.kicker{font-size:13px;letter-spacing:.32em;text-transform:uppercase;color:var(--teal);font-weight:700;margin-bottom:18px}
.dark .kicker{color:var(--gold)}
.h-xl{font-size:clamp(34px,4.6vw,58px);font-weight:900;line-height:1.18;letter-spacing:-.02em}
.h-lg{font-size:clamp(26px,3.2vw,40px);font-weight:900;line-height:1.25;letter-spacing:-.02em}
.lead{font-size:clamp(15px,1.35vw,19px);line-height:1.75;color:var(--muted);font-weight:400}
.dark .lead{color:rgba(250,248,244,.72)}
.accent{color:var(--teal)}
.dark .accent{color:var(--gold)}
.rule{width:56px;height:3px;background:var(--gold);margin:26px 0 30px}

/* ---------- 헤더/푸터 ---------- */
.brandbar{position:absolute;top:0;left:0;right:0;display:flex;justify-content:space-between;align-items:center;padding:26px 84px;font-family:var(--font-head)}
/* 브랜드 로고 — 공식 SVG. 밝은 슬라이드는 dark 버전, 어두운 슬라이드(.dark)는 light 버전 */
.brandbar .logo{display:block;text-decoration:none;cursor:pointer;line-height:0}
.brandbar .logo img{height:19px;width:auto;display:block}
.brandbar .logo .on-light{display:block}
.brandbar .logo .on-dark{display:none}
.dark .brandbar .logo .on-light{display:none}
.dark .brandbar .logo .on-dark{display:block}
/* 연락처 링크 — 전화·메일·홈페이지. 본문 색을 그대로 따르고 터치 시에만 밑줄 */
a.contact-link{color:inherit;text-decoration:none}
a.contact-link:hover,a.contact-link:active{text-decoration:underline}
.dark .brandbar .logo{color:var(--ivory)}
.brandbar .logo b{color:var(--gold);font-weight:900;margin:0 1px}
.brandbar .logo span{font-weight:300;letter-spacing:.12em;margin-left:7px}
.brandbar .tag{font-size:11.5px;letter-spacing:.22em;color:var(--muted)}
.dark .brandbar .tag{color:rgba(250,248,244,.5)}
.pagenum{position:absolute;bottom:26px;right:84px;font-size:12px;letter-spacing:.12em;color:var(--muted)}
.dark .pagenum{color:rgba(250,248,244,.45)}

/* ---------- 카드/그리드 ---------- */
.grid{display:grid;gap:18px}
.g2{grid-template-columns:1fr 1fr}
.g3{grid-template-columns:repeat(3,1fr)}
.g4{grid-template-columns:repeat(4,1fr)}
.card{background:#fff;border:1px solid var(--line);border-radius:14px;padding:26px 24px;position:relative}
.card .num{font-family:var(--font-head);font-weight:900;font-size:13px;letter-spacing:.14em;color:var(--gold);margin-bottom:12px}
.card h3{font-size:clamp(15px,1.35vw,19px);font-weight:700;margin-bottom:10px;letter-spacing:-.01em}
.card p{font-size:clamp(12.5px,1.05vw,14.5px);line-height:1.66;color:var(--muted)}
.card.bar::before{content:'';position:absolute;left:0;top:22px;bottom:22px;width:3px;background:var(--gold);border-radius:2px}

/* metric */
.metric{background:#fff;border:1px solid var(--line);border-radius:14px;padding:28px 24px;text-align:left}
.metric .val{font-family:var(--font-head);font-weight:900;font-size:clamp(30px,3.4vw,46px);color:var(--green);letter-spacing:-.02em;line-height:1.05}
.metric .val small{font-size:.5em;font-weight:700;color:var(--teal);margin-left:2px}
.metric .lbl{font-size:13px;color:var(--muted);margin-top:10px;line-height:1.5}

/* 타임라인 */
.tl{display:grid;grid-template-columns:1fr 1fr;gap:12px 40px}
.tl-item{display:flex;gap:16px;align-items:flex-start;padding:12px 0;border-bottom:1px solid var(--line)}
.tl-item .wk{flex:0 0 74px;font-family:var(--font-head);font-weight:900;font-size:14px;color:var(--green);background:rgba(7,46,43,.06);border-radius:8px;text-align:center;padding:7px 0}
.tl-item .wk.final{background:var(--green);color:var(--gold)}
.tl-item p{font-size:clamp(12px,1.02vw,14px);line-height:1.55;color:var(--ink);padding-top:6px}

/* before/after */
.ba{display:flex;align-items:center;gap:14px;background:#fff;border:1px solid var(--line);border-radius:14px;padding:20px 24px}
.ba .item-name{flex:0 0 128px;font-weight:700;font-size:clamp(13px,1.1vw,15.5px)}
.ba .before{color:var(--muted);text-decoration:line-through;font-size:clamp(13px,1.15vw,16px);white-space:nowrap}
.ba .arrow{color:var(--gold);font-weight:900}
.ba .after{font-family:var(--font-head);font-weight:900;color:var(--green);font-size:clamp(16px,1.5vw,21px);white-space:nowrap}
.ba .gain{margin-left:auto;font-size:12.5px;font-weight:700;color:#fff;background:var(--teal);border-radius:999px;padding:5px 12px;white-space:nowrap}

/* index list */
.idx{counter-reset:i}
.idx li{list-style:none;display:flex;align-items:baseline;gap:22px;padding:16px 0;border-bottom:1px solid rgba(251,251,250,.14);font-family:var(--font-head)}
.idx li::before{counter-increment:i;content:"0" counter(i);font-weight:900;color:var(--gold);font-size:15px;letter-spacing:.1em}
.idx li span{font-size:clamp(17px,1.7vw,23px);font-weight:700;letter-spacing:-.01em}
.idx li em{margin-left:auto;font-style:normal;font-size:12.5px;color:rgba(250,248,244,.5)}

/* 애니메이션 */
@keyframes fadeUp{from{opacity:0;transform:translateY(26px)}to{opacity:1;transform:translateY(0)}}
.inview .a-stagger>*{animation:fadeUp .55s ease-out both}
.inview .a-stagger>*:nth-child(2){animation-delay:.12s}
.inview .a-stagger>*:nth-child(3){animation-delay:.22s}
.inview .a-stagger>*:nth-child(4){animation-delay:.32s}
.inview .a-stagger>*:nth-child(5){animation-delay:.42s}
.inview .a-stagger>*:nth-child(6){animation-delay:.52s}
.inview .a-up{animation:fadeUp .6s ease-out both}

/* 내비게이션 */
.progress-bar{position:fixed;top:0;left:0;height:3px;background:var(--gold);transition:width .3s;z-index:1000}
.nav-controls{position:fixed;bottom:18px;right:18px;display:flex;align-items:center;gap:10px;z-index:1000;opacity:.85}
.nav-btn{background:rgba(7,46,43,.8);border:none;color:#FAF8F4;width:34px;height:34px;border-radius:50%;cursor:pointer;font-size:14px}
.nav-btn:hover{background:var(--green)}
.slide-counter{color:rgba(120,130,128,.9);font-size:13px;font-family:var(--font-head)}

.chart-box{background:#fff;border:1px solid var(--line);border-radius:14px;padding:20px}
.note{font-size:11.5px;color:var(--muted);margin-top:12px;letter-spacing:.02em}
.split{display:grid;grid-template-columns:1.05fr 1fr;gap:46px;align-items:center}
.checkline{display:flex;gap:12px;align-items:flex-start;padding:10px 0;border-bottom:1px solid var(--line)}
.checkline .ck{flex:0 0 20px;height:20px;border-radius:6px;background:var(--green);color:var(--gold);font-size:12px;display:flex;align-items:center;justify-content:center;font-weight:900;margin-top:2px}
.checkline p{font-size:clamp(12.5px,1.08vw,15px);line-height:1.6}
.checkline p small{display:block;color:var(--muted);font-size:.86em;margin-top:2px}

@media (max-width:768px){
  .slide{padding:92px 22px 74px;min-height:auto}
  .brandbar{padding:18px 26px}
  .pagenum{right:26px}
  .g3,.g4,.tl,.split{grid-template-columns:1fr}
  .g2{grid-template-columns:1fr}
}
`
