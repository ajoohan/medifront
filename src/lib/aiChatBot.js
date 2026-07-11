// AI 채팅 상담 — 사이트 콘텐츠(data.js) 기반 키워드 매칭 응답 엔진
// 외부 API 없이 동작하는 규칙 기반 봇. 추후 LLM API 연동 시
// getBotReply만 비동기 호출로 교체하면 UI는 그대로 사용 가능.
import { BRAND, FAQ, METRICS, PROCESS, SERVICES } from '../data'

// 상담 신청 폼으로 이동하는 공통 CTA
const CONTACT_LINK = { label: '무료 상담 신청하기', href: '/#contact-form' }

const DEFAULT_QUICK_REPLIES = [
  '개원 컨설팅이 궁금해요',
  '마케팅 대행은 어떻게 하나요?',
  '개원 준비 기간은 얼마나 걸리나요?',
  '상담은 어떻게 신청하나요?',
]

export const GREETING = {
  text: `안녕하세요! 메디프론트 AI 상담 도우미입니다. 🙂\n개원 준비, 병·의원 마케팅, 경영 컨설팅에 대해 무엇이든 물어보세요.`,
  quickReplies: DEFAULT_QUICK_REPLIES,
}

// 규칙: keywords 중 하나라도 포함되면 후보, 매칭 수가 많은 규칙 우선
const RULES = [
  {
    keywords: ['개원', '오픈', '창업', '입지', '인테리어', '개설'],
    text: `개원 컨설팅은 입지 선정부터 조건·계약 협의, 인테리어, 개설등록, 구인까지 개원의 전 과정을 함께합니다.\n\n${PROCESS.map((p, i) => `${i + 1}. ${p.title} — ${p.desc}`).join('\n')}\n\n지금까지 ${METRICS[0].value.replace('+', '곳 이상')}의 병·의원 개원을 함께했고, 폐업률은 ${METRICS[2].value}입니다.`,
    quickReplies: ['개원 준비 기간은 얼마나 걸리나요?', '임대차계약은 보통 몇 년 하나요?'],
    link: CONTACT_LINK,
  },
  {
    keywords: ['마케팅', '홍보', '블로그', '유튜브', '광고', '플레이스', 'seo'],
    text: `마케팅 운영대행은 블로그·유튜브·홈페이지·검색광고·네이버 플레이스까지 병원 마케팅 전 채널을 전담팀이 통합 운영하는 서비스입니다.\n\n자체 개발 AI로 경쟁 병원을 분석하고 환자 심리 기반 콘텐츠를 만들어, 원장님은 진료에만 집중하실 수 있습니다.`,
    quickReplies: ['비용은 어떻게 되나요?', '상담은 어떻게 신청하나요?'],
    link: CONTACT_LINK,
  },
  {
    keywords: ['경영', '매출', '신환', '재방문', '운영', 'kpi', '컨설팅 범위'],
    text: `경영·성과 컨설팅은 매출·신환·재방문 데이터를 진단해 병목을 찾고 개선하는 서비스입니다.\n\n상권 분석, 매출 진단, KPI 설계, 진료 프로세스 개선까지 성과 중심으로 설계하며, 컨설팅 병·의원의 월 매출은 ${METRICS[3].value} 수준입니다.`,
    link: CONTACT_LINK,
  },
  {
    keywords: ['ai', '에이아이', '인공지능', '데이터', '자동화'],
    text: `메디프론트는 병·의원에 특화된 AI·데이터 솔루션을 자체 개발해 사용합니다.\n\n${SERVICES[3].desc}\n\n"사람의 전문성 + AI의 속도"로 압도적인 결과를 만드는 것이 저희의 방식입니다.`,
    link: CONTACT_LINK,
  },
  {
    keywords: ['비용', '가격', '수수료', '요금', '견적', '얼마'],
    text: `컨설팅 비용은 개원 규모, 진료과목, 서비스 범위에 따라 달라져 일률적으로 안내드리기 어렵습니다.\n\n무료 상담을 신청해 주시면 상황을 진단한 뒤 맞춤 견적을 안내드립니다. 상담 리포트는 무료이며, 평균 24시간 내에 응답드립니다.`,
    link: CONTACT_LINK,
  },
  {
    keywords: ['상담', '신청', '문의', '연락', '예약'],
    text: `무료 상담은 홈페이지의 상담 신청 폼으로 접수하실 수 있습니다. 성함·연락처·개원 희망 지역을 남겨주시면 담당 컨설턴트가 평균 24시간 내에 연락드립니다.\n\n전화(${BRAND.phone}) 또는 이메일(${BRAND.email})로도 문의 가능합니다.`,
    link: CONTACT_LINK,
  },
  {
    keywords: ['전화', '번호', '이메일', '메일', '주소', '위치', '어디'],
    text: `메디프론트 연락처 안내입니다.\n\n📞 전화: ${BRAND.phone}\n✉️ 이메일: ${BRAND.email}\n🏢 주소: ${BRAND.address}`,
    link: CONTACT_LINK,
  },
  {
    keywords: ['안녕', '하이', 'hello', 'hi', '반가'],
    text: '안녕하세요! 무엇을 도와드릴까요? 아래 버튼을 눌러보시거나 궁금한 점을 직접 입력해 주세요.',
    quickReplies: DEFAULT_QUICK_REPLIES,
  },
  {
    keywords: ['고마', '감사', '땡큐', 'thank'],
    text: '도움이 되었다니 기쁩니다! 더 궁금한 점이 있으면 언제든 물어보세요. 😊',
    quickReplies: ['상담은 어떻게 신청하나요?'],
  },
  // FAQ 항목을 규칙으로 자동 편입 — 질문 문장의 핵심 어절을 키워드로 사용
  ...FAQ.map((f) => ({
    keywords: f.q
      .replace(/[?.,]/g, '')
      .split(/\s+/)
      .filter((w) => w.length >= 2),
    text: f.a,
    link: CONTACT_LINK,
  })),
]

const FALLBACK = {
  text: `죄송합니다, 질문을 정확히 이해하지 못했어요. 🙏\n개원·마케팅·경영 컨설팅 관련 질문을 해주시거나, 아래에서 무료 상담을 신청하시면 전문 컨설턴트가 직접 답변드립니다.`,
  quickReplies: DEFAULT_QUICK_REPLIES,
  link: CONTACT_LINK,
}

export function getBotReply(input) {
  const q = String(input || '')
    .toLowerCase()
    .trim()
  if (!q) return FALLBACK

  let best = null
  let bestScore = 0
  for (const rule of RULES) {
    const score = rule.keywords.reduce((n, k) => (q.includes(k.toLowerCase()) ? n + 1 : n), 0)
    if (score > bestScore) {
      best = rule
      bestScore = score
    }
  }
  if (!best) return FALLBACK
  return { text: best.text, quickReplies: best.quickReplies, link: best.link }
}
