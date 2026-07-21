// 의사 면허 확인 관련 공용 값
//
// 확인 방식: 보건복지부 면허민원 '기관조회'(개별조회)에서 성명·면허종별·면허번호·생년월일로
// 등록 여부를 조회한다. 조회에는 기관 이용 신청(범용 공동인증서 로그인)과
// 정보주체(회원) 동의가 필요하며, 1일 이내 동일 의료인 5회 초과 조회 시 제한된다.
export const LICENSE_CHECK_URL = 'https://lic.mohw.go.kr/instt/instt_srch_each.do?MENU_ID=I-02-01'

// 의사 승인 대기 = 가입 때 면허번호를 냈지만 아직 등급이 '의사'가 아닌 회원.
// 관리자가 면허를 확인해 등급을 '의사'로 바꾸면 대기 목록에서 빠진다.
export const isPendingDoctor = (m) => !!m.licenseNo && m.grade !== '의사'
