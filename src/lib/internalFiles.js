// 내부 자료실에 상시 걸어 두는 파일형 자료.
//
// 본문을 관리자 화면에서 작성하는 일반 자료(internal_docs)와 달리, 완성된 HTML 문서를
// 그대로 올려 두고 열람·공유하는 자료다. public/internal/ 에 파일을 넣고 여기 한 줄을
// 추가하면 자료실 목록에 나온다.
//
// ⚠️ public/ 아래 파일은 주소를 아는 사람이면 볼 수 있다. 자료실 목록 자체는 관리자만
// 열 수 있지만, '링크 복사'로 넘긴 주소는 로그인 없이 열린다 — 대외 공유용으로 쓴다는
// 전제이므로, 외부에 나가면 안 되는 문서는 여기 두지 말 것.
export const INTERNAL_FILES = [
  {
    id: 'hxd',
    file: '/internal/hxd_full_2.html',
    title: '건강 경험 솔루션 (Health Experience Design)',
    summary:
      '병원 방문 전·중·후의 환자 경험을 설계하는 메디프론트 HXD 제안 자료입니다. PC·모바일 모두 대응합니다.',
    category: '영업',
    date: '2026-07-28',
  },
]
