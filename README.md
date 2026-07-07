# 메디프론트(MEDIFRONT) 병원 컨설팅 — 랜딩 페이지

haroop.com 구성을 참고해 제작한 병원 컨설팅 랜딩 페이지입니다.
**Vite + React (JavaScript)** 기반의 단일 페이지 사이트입니다.

## 실행 방법

```bash
npm install      # 최초 1회 (이미 설치됨)
npm run dev      # 개발 서버 → http://localhost:5173
npm run build    # 배포용 빌드 → dist/
npm run preview  # 빌드 결과 미리보기
```

> 이 PC에는 winget으로 **Node.js LTS(v24)** 가 설치되어 있습니다.
> 새 터미널에서 `node`/`npm`이 인식되지 않으면 터미널을 재시작하세요.

## 프로젝트 구조

```
plustonic-medical/
├─ index.html                 # HTML 진입점 (메타태그, 폰트 CDN)
├─ vite.config.js
├─ public/favicon.svg
└─ src/
   ├─ main.jsx                # React 진입점
   ├─ App.jsx                 # 전체 섹션 조립
   ├─ index.css               # 디자인 시스템 + 전 컴포넌트 스타일 (청록/teal 테마)
   ├─ data.js                 # ⭐ 모든 문구/수치/연락처 데이터
   ├─ hooks/useReveal.js      # 스크롤 페이드인
   └─ components/
      ├─ Header.jsx           # 상단 네비 (스크롤 시 배경 변화, 모바일 메뉴)
      ├─ Logo.jsx             # MEDIFRONT 워드마크 로고 (light/dark variant)
      ├─ Hero.jsx             # 히어로 + 성장 차트 카드
      ├─ Metrics.jsx          # 핵심 지표 4종
      ├─ Services.jsx         # 4대 서비스 (마케팅/경영/개원/AI)
      ├─ PainPoints.jsx       # 원장님 고민 + 해답
      ├─ Results.jsx          # 진료과목별 성과 카드
      ├─ Process.jsx          # 4단계 프로세스
      ├─ AISection.jsx        # AI 기술력
      ├─ Categories.jsx       # 진료과목별 성장 데이터
      ├─ FAQ.jsx              # 아코디언 FAQ
      ├─ Contact.jsx          # 무료 진단 CTA + 상담 신청 폼
      ├─ Footer.jsx           # 사업자 정보/링크
      └─ Icons.jsx            # 인라인 SVG 아이콘 세트
```

## 콘텐츠 수정 방법

대부분의 문구·수치·연락처는 **`src/data.js` 한 파일**에서 관리합니다.
아래 항목들은 예시(placeholder)이므로 **실제 값으로 교체**하세요:

- `BRAND` — 전화번호, 주소, 대표자명, 사업자등록번호, 통신판매업 신고번호
- `METRICS`, `RESULTS`, `CATEGORIES` — 성과 수치 (현재는 예시 값)
- 색상/디자인 조정은 `src/index.css` 상단 `:root` 의 CSS 변수에서 가능

## 상담 폼 연동

`src/components/Contact.jsx` 의 `onSubmit` 함수는 현재 데모 상태(화면 표시만)입니다.
실제 전송은 아래 중 택1로 연결하세요:
- 이메일 발송 API (예: Formspree, EmailJS)
- 자체 백엔드 API 엔드포인트
- 구글 폼 / 스프레드시트 연동

`// TODO:` 주석이 달린 지점이 연결 위치입니다.

## 참고

- 폰트: Pretendard (CDN)
- 성과·후기 수치는 예시이며, 실제 의료광고 게재 시 **의료법·의료광고 심의** 기준을
  반드시 검토하세요. (과장·객관적 근거 없는 표현 주의)
