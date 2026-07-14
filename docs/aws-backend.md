# 메디프론트 AWS 백엔드 이전 가이드 (2단계: Supabase → AWS)

1단계(docs/aws-hosting.md)로 프론트를 S3+CloudFront 에 올린 상태에서,
백엔드(회원 인증 + 데이터)를 Supabase 에서 **AWS 서버리스**로 옮기는 절차입니다.

- **회원 인증** → Amazon Cognito (가입·로그인·비밀번호 재설정)
- **데이터** → Amazon DynamoDB (회원, 매거진, 문의, 상담, 성과 등 8종)
- **API** → Lambda + API Gateway (프론트가 호출하는 REST API)

모두 사용량 기반 과금이라 현재 트래픽 수준에서는 **월 비용이 거의 0원**입니다.
서버 관리(패치·백업 등)도 필요 없습니다.

> ⚠️ 이전이 완료되기 전에는 Supabase 프로젝트를 삭제하지 마세요.
> 마지막 단계의 체크리스트 확인 후 삭제하면 됩니다.

---

## 0. 준비물

- AWS CLI 설치 + `aws configure` 완료 (1단계 프론트 배포와 동일 계정)
- Node.js (데이터 이전 스크립트 실행용 — 프론트 빌드와 동일 환경이면 됨)
- Supabase 대시보드 접근 권한 (데이터 내보내기용 service_role 키)

---

## 1. 백엔드 배포 (Cognito + DynamoDB + Lambda API)

```bash
bash scripts/deploy-backend.sh
```

이 스크립트가 하는 일:

1. CloudFormation 스택 `medifront-backend` 생성 (서울 리전)
2. Cognito 사용자 풀, DynamoDB 테이블, Lambda API 자동 구성
3. 프론트 빌드에 필요한 환경변수를 **`.env.production.local` 에 자동 기록**

출력에 표시되는 값 4개(VITE_...)와 `TABLE_NAME` 은 이후 단계에서 사용합니다.

---

## 2. 데이터 이전 (Supabase → AWS)

### 2-1. Supabase 에서 내보내기

Supabase 대시보드 > Project Settings > API 에서 **service_role** 키를 복사한 뒤:

```bash
SUPABASE_SERVICE_KEY=<service_role키> node scripts/migrate/export-supabase.mjs
```

`scripts/migrate/out/` 에 테이블 8종 + 회원 계정 목록이 JSON 으로 저장됩니다.
(개인정보가 담기므로 git 에는 올라가지 않도록 되어 있습니다 — 이전 후 폴더를 삭제하세요.)

### 2-2. DynamoDB 로 데이터 가져오기

```bash
TABLE_NAME=medifront-backend-data node scripts/migrate/import-dynamodb.mjs
```

(`TABLE_NAME` 은 1번 스크립트 출력값 — 기본은 `medifront-backend-data`)

### 2-3. Cognito 로 회원 계정 가져오기

```bash
USER_POOL_ID=<UserPoolId 출력값> node scripts/migrate/import-cognito.mjs
```

> **비밀번호는 이전되지 않습니다.** (Supabase 밖으로 꺼낼 수 없는 값)
> 기존 회원은 첫 로그인 시 **[아이디/비밀번호 찾기]** 로 새 비밀번호를 1회 설정해야
> 합니다. 회원 수가 적다면 개별 안내를, 많다면 공지(팝업/메일)를 권장합니다.

---

## 3. 프론트 재배포

1단계에서 `.env.production.local` 이 자동 생성되었으므로 바로:

```bash
bash scripts/deploy-aws.sh
```

배포 후 사이트에서 확인할 것:

- [ ] 홈페이지 성과 섹션·매거진 목록이 실데이터로 표시되는가
- [ ] 회원가입 → 메일로 받은 6자리 코드 입력 → 로그인 되는가
- [ ] [아이디/비밀번호 찾기] → 코드 → 새 비밀번호 설정 → 로그인 되는가
- [ ] 상담 신청 폼 접수가 관리자 화면에 나타나는가
- [ ] 관리자 화면에서 회원/매거진/상담/성과 데이터가 보이고 수정되는가

> 참고: Vercel 에도 배포 중이라면 Vercel 환경변수에 같은 VITE_ 값 4개를 넣어야
> 합니다. AWS 로 완전히 옮겼다면 Vercel 프로젝트는 정리해도 됩니다.

---

## 4. 인증 메일 관련 (중요)

Cognito 는 기본 발신 주소(no-reply@verificationemail.com)로 **하루 최대 50통**의
메일을 보낼 수 있습니다. 가입·비밀번호 재설정이 하루 50건을 넘는 시점이 오면
**Amazon SES** 를 연결해 한도를 올리고 발신 주소도 no-reply@medifront.co.kr 로
바꿀 수 있습니다. (Cognito 콘솔 > User pool > Messaging 에서 설정)

메일 문구는 `backend/template.yaml` 의 `VerificationMessageTemplate`(가입 코드),
`InviteMessageTemplate`(운영자 초대) 에서 수정 후 재배포하면 됩니다.

---

## 5. 기존과 달라지는 점 (UX)

| 항목                  | 기존 (Supabase)         | 이후 (AWS Cognito)                  |
| --------------------- | ----------------------- | ----------------------------------- |
| 가입 확인             | 메일의 **링크 클릭**    | 메일의 **6자리 코드 입력**          |
| 비밀번호 재설정       | 메일 링크 → 새 비밀번호 | 메일 코드 → 코드 + 새 비밀번호 입력 |
| 운영자 등록 메일      | 매직링크(바로 로그인)   | 초대 메일(임시 비밀번호 포함)       |
| 관리자 수동 회원 추가 | 인증 메일 발송 필요     | 인증 절차 없이 즉시 로그인 가능     |

관리자 로그인(VITE_ADMIN_EMAIL/PASSWORD 환경변수 방식)은 그대로입니다.

---

## 6. 보안 메모

데이터 API 는 기존 Supabase 프로토타입 정책(anon 키 전체 허용)과 **동일한 수준**으로
열려 있습니다(도메인 CORS 제한만 적용). 기존과 보안 수준이 같아지도록 맞춘 것이며,
정식 오픈 전에는 관리자용 쓰기 경로에 인증(Cognito 관리자 그룹 등)을 붙이는 작업을
권장합니다.

---

## 7. Supabase 정리 체크리스트

아래가 모두 확인되면 Supabase 프로젝트를 삭제해도 됩니다.

- [ ] 3번의 배포 후 확인 항목이 모두 통과
- [ ] 관리자 화면 데이터 건수가 기존과 일치 (회원/매거진/문의/상담/성과)
- [ ] `scripts/migrate/out/` 폴더 삭제 (개인정보 파일)
- [ ] 며칠 운영하며 이상이 없는지 관찰 (권장: 1~2주)
- [ ] (선택) Supabase 대시보드에서 최종 백업 다운로드 후 프로젝트 삭제

삭제 후에는 저장소의 `supabase/` 폴더(과거 SQL)도 지워도 됩니다.
