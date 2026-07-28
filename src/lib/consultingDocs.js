// 회원 전용 컨설팅 자료 목록 (한 곳에서 관리 — 헤더 배지와 목록 화면이 함께 쓴다)
// 본문은 public/ 의 단일 HTML 덱이라 라우터를 거치지 않는다.
//
// date = 등록일. 목록은 이 값을 기준으로 최근 자료가 위에 온다.
// 노출 여부는 관리자 > 콘텐츠 관리 > 컨설팅 자료에서 켜고 끄며, 값은 DB(consulting_docs)에 있다.
// id 는 그 노출 설정과 자료를 잇는 열쇠라 한번 정하면 바꾸지 않는다.
export const CONSULTING_DOCS = [
  {
    id: 'pharmacy-paju',
    date: '2026-07-27',
    file: '/consulting_2.html',
    kicker: 'PHARMACY NEW MODEL',
    title: '약국 신(新)모델 입점 예시 — 파주운정',
    desc: '배후 세대·상권 인구 분석부터 의원·약국 입점 모델(M1/M2)까지, 신규 입점 전략 제안 자료입니다.',
  },
  {
    id: 'opening-process',
    date: '2026-07-24',
    file: '/consulting_1.html',
    kicker: 'OPENING CONSULTING',
    title: '개원컨설팅 프로세스',
    desc: '입지 선정·계약부터 인테리어, 행정지원, 부설클리닉까지 개원 전 과정의 절차와 실제 사례를 정리했습니다.',
  },
]

// 등록일 최신순 (같은 날이면 배열에 적은 순서를 유지)
export function byNewest(a, b) {
  if (a.date === b.date) return 0
  return a.date < b.date ? 1 : -1
}

// 방문자 목록 정렬 규칙:
//   1) 열람 가능한 자료가 먼저, 준비 중(딤 처리)인 자료는 무조건 아래로
//   2) 그 안에서 등록일 최신순
export function sortForVisitors(docs) {
  return [...docs].sort((a, b) => {
    if (!!a.hidden !== !!b.hidden) return a.hidden ? 1 : -1
    return byNewest(a, b)
  })
}
