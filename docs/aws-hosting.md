# 메디프론트 AWS 호스팅 가이드 (1단계: 프론트 + 도메인)

기존에 운영 중인 다른 사이트는 **그대로 두고**, medifront 전용으로 **새 S3 버킷 + 새 CloudFront 배포**를 만들어 격리합니다.
백엔드(인증·데이터)의 AWS 이전은 2단계 문서 **docs/aws-backend.md** 를 참고하세요.

> 리소스 이름은 아래처럼 `medifront-` 접두어로 만들어 기존 사이트 리소스와 절대 겹치지 않게 하세요.

---

## 0. 준비물

- AWS 콘솔 로그인 (기존 계정 사용 가능 — 새 리소스만 추가)
- 도메인 `medifront.co.kr` (whois 관리 콘솔 접근)
- (선택) 로컬에 AWS CLI 설치 후 `aws configure` — 자동 배포 스크립트용

---

## 1. S3 버킷 생성 (정적 파일 저장소)

1. S3 → **버킷 만들기**
2. 버킷 이름: `medifront-co-kr-web` (전 세계 고유해야 함, 이미 있으면 뒤에 숫자 추가)
3. 리전: `ap-northeast-2 (서울)`
4. **모든 퍼블릭 액세스 차단 = 켜둔 채로** 생성 (CloudFront로만 노출할 것이라 버킷은 비공개 유지)
5. 생성한 버킷에 `dist/` 빌드 결과물 업로드 (2단계 이후 스크립트로 자동화)

---

## 2. CloudFront 배포 생성 (HTTPS + 전송)

1. CloudFront → **배포 생성**
2. **원본 도메인**: 위 S3 버킷 선택
3. **원본 액세스**: "Origin access control settings (권장)" → OAC 새로 생성 → 적용
   (안내에 뜨는 **버킷 정책 업데이트**를 S3에 복사/적용해야 CloudFront가 읽을 수 있음)
4. **뷰어 프로토콜 정책**: Redirect HTTP to HTTPS
5. **기본 루트 객체**: `index.html`
6. 생성

### 2-1. SPA 라우팅 폴백 (필수)

React 라우팅(`/admin`, `/magazine/1` 등)이 새로고침·직접접속에서 404 나지 않게:

- 배포 → **오류 페이지(Error pages)** 탭 → **사용자 정의 오류 응답 생성** 을 2개 추가
  - HTTP 오류 코드 `403` → 응답 페이지 경로 `/index.html`, HTTP 응답 코드 `200`
  - HTTP 오류 코드 `404` → 응답 페이지 경로 `/index.html`, HTTP 응답 코드 `200`

---

## 3. SSL 인증서 (ACM) — medifront.co.kr 용

CloudFront에 커스텀 도메인을 붙이려면 인증서가 **버지니아 북부(us-east-1)** 에 있어야 합니다.

1. 리전을 **N. Virginia (us-east-1)** 로 변경
2. Certificate Manager(ACM) → **인증서 요청** → 퍼블릭 인증서
3. 도메인 이름 2개 추가:
   - `medifront.co.kr`
   - `www.medifront.co.kr`
4. 검증 방법: **DNS 검증**
5. 발급 대기 화면에 나오는 **CNAME 검증 레코드(이름/값)** 를 whois DNS에 추가 (아래 5단계 참고)
6. 검증 완료(상태: 발급됨)까지 몇 분 대기

---

## 4. CloudFront에 도메인 연결

1. 리전을 다시 서울로 두고, 만든 배포 → **설정 편집**
2. **대체 도메인 이름(CNAME)** 에 추가:
   - `medifront.co.kr`
   - `www.medifront.co.kr`
3. **사용자 정의 SSL 인증서**: 3단계에서 발급받은 ACM 인증서 선택
4. 저장 후 배포 완료 대기 (몇 분)
5. 배포의 **도메인 이름**(`dxxxxxxxx.cloudfront.net`)을 메모 → 5단계에서 사용

---

## 5. whois DNS 레코드 추가

whois 도메인 관리 → medifront.co.kr → **DNS 관리(네임서버/DNS 레코드 설정)** 에서 추가:

| 유형   | 이름/호스트                 | 값                                             |
| ------ | --------------------------- | ---------------------------------------------- |
| CNAME  | `_xxxx`(ACM이 준 검증 이름) | ACM이 준 검증 값 (3단계)                       |
| CNAME  | `www`                       | `dxxxxxxxx.cloudfront.net` (CloudFront 도메인) |
| (apex) | `@` 또는 medifront.co.kr    | 아래 참고                                      |

### apex(맨 앞 www 없는 주소) 처리

`medifront.co.kr`(apex)는 CNAME을 직접 걸 수 없습니다(DNS 규칙). whois 콘솔에서 가능한 방법 중 하나:

- **A) whois "웹 포워딩/URL 포워딩"** 지원 시: `medifront.co.kr` → `https://www.medifront.co.kr` 로 포워딩 설정
- **B) whois가 ALIAS/ANAME 레코드 지원 시**: apex → `dxxxxxxxx.cloudfront.net` 로 지정
- 어느 쪽이 가능한지 whois DNS 화면을 보고 알려주시면 정확히 안내드립니다.

---

## 6. Supabase 리다이렉트 URL 추가 (인증 메일용)

새 도메인에서 회원가입 인증·비밀번호 재설정 링크가 동작하도록:

- Supabase 대시보드 → Authentication → **URL Configuration**
- **Site URL**: `https://medifront.co.kr`
- **Redirect URLs** 에 추가: `https://medifront.co.kr/**`, `https://www.medifront.co.kr/**`

---

## 7. 배포 (파일 올리기)

로컬에서 (AWS CLI 설정 후):

```bash
# scripts/deploy-aws.sh 안의 BUCKET / DISTRIBUTION_ID 를 본인 값으로 채운 뒤
bash scripts/deploy-aws.sh
```

또는 수동: `npm run build` → S3 버킷에 `dist/` 내용 업로드 → CloudFront 캐시 무효화.

---

## 완료 확인

- `https://medifront.co.kr`, `https://www.medifront.co.kr` 접속
- 로그인/회원가입, 관리자(/admin), 매거진 상세(/magazine/1) 새로고침까지 정상인지 확인
