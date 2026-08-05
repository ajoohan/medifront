#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────
# 메디프론트 백엔드(Cognito + DynamoDB + Lambda API) 배포 스크립트
# 사전 준비: AWS CLI 설치 + `aws configure`로 자격증명 등록 (프론트 배포와 동일 계정)
# 사용:
#   bash scripts/deploy-backend.sh
# 배포가 끝나면 프론트 빌드에 필요한 값을 .env.production.local 에 자동 기록한다.
# ─────────────────────────────────────────────────────────
set -euo pipefail
cd "$(dirname "$0")/.."

STACK="medifront-backend"

# ⚠️ 리전은 서울로 고정한다. 예전에는 ${AWS_REGION:-ap-northeast-2} 였는데,
# CloudShell 은 콘솔에서 보고 있던 리전을 AWS_REGION 에 자동으로 넣는다. 그래서 콘솔이
# 버지니아(us-east-1)에 있으면 배포가 조용히 그쪽으로 가서, 서울의 운영 스택은 그대로인 채
# 엉뚱한 리전에 새 스택이 생겼다(실패하면 ROLLBACK_COMPLETE 로 남아 다음 배포까지 막는다).
# 다른 리전에 배포할 일이 생기면 MEDIFRONT_REGION 으로 명시적으로 지정한다.
REGION="${MEDIFRONT_REGION:-ap-northeast-2}"   # 서울
export AWS_REGION="${REGION}"
export AWS_DEFAULT_REGION="${REGION}"
echo "배포 리전: ${REGION}"

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ARTIFACT_BUCKET="medifront-backend-artifacts-${ACCOUNT_ID}"

echo "1) 배포 아티팩트 버킷 준비 (${ARTIFACT_BUCKET})..."
if ! aws s3api head-bucket --bucket "${ARTIFACT_BUCKET}" 2>/dev/null; then
  aws s3api create-bucket --bucket "${ARTIFACT_BUCKET}" --region "${REGION}" \
    --create-bucket-configuration LocationConstraint="${REGION}" >/dev/null
fi

echo "2) Lambda 코드 패키징..."
aws cloudformation package \
  --template-file backend/template.yaml \
  --s3-bucket "${ARTIFACT_BUCKET}" \
  --output-template-file backend/.packaged.yaml \
  --region "${REGION}" >/dev/null

echo "3) CloudFormation 스택 배포 (${STACK})..."
# 소셜 로그인 시크릿: 환경변수가 있으면 파라미터로 전달한다. 없으면 이전 배포 값 유지.
#   GOOGLE_CLIENT_SECRET=... bash scripts/deploy-backend.sh          (구글)
#   NAVER_CLIENT_ID=... NAVER_CLIENT_SECRET=... bash scripts/deploy-backend.sh  (네이버)
# (시크릿은 화면에 출력되지 않고, CloudFormation 파라미터도 NoEcho 라 콘솔에 남지 않는다)
OVERRIDES=()
if [ -n "${GOOGLE_CLIENT_SECRET:-}" ]; then
  OVERRIDES+=("GoogleClientSecret=${GOOGLE_CLIENT_SECRET}")
  echo "   (구글 IdP 포함 배포)"
fi
if [ -n "${NAVER_CLIENT_ID:-}" ]; then
  OVERRIDES+=("NaverClientId=${NAVER_CLIENT_ID}")
fi
if [ -n "${NAVER_CLIENT_SECRET:-}" ]; then
  OVERRIDES+=("NaverClientSecret=${NAVER_CLIENT_SECRET}")
  echo "   (네이버 로그인 포함 배포)"
fi
# 휴대폰 본인인증(실명인증) — 인증사 계약 후 키를 넣으면 기능이 켜진다
#   VERIFY_API_KEY=... VERIFY_API_SECRET=... bash scripts/deploy-backend.sh
if [ -n "${VERIFY_API_KEY:-}" ]; then
  OVERRIDES+=("VerifyApiKey=${VERIFY_API_KEY}")
fi
if [ -n "${VERIFY_API_SECRET:-}" ]; then
  OVERRIDES+=("VerifyApiSecret=${VERIFY_API_SECRET}")
  echo "   (휴대폰 본인인증 포함 배포)"
fi
# PPT → 자료 AI 변환(Gemini) — 키를 넣으면 '#AI로 다듬기'가 켜진다
#   GEMINI_API_KEY=... bash scripts/deploy-backend.sh
#
# ⚠️ 한 번 넣으면 스택에 남는다. 다음 배포에서 이 변수를 빼도 기존 값이 유지되므로
# 매번 다시 넣을 필요는 없다. 키를 바꾸거나 지울 때만 다시 지정한다.
if [ -n "${GEMINI_API_KEY:-}" ]; then
  OVERRIDES+=("GeminiApiKey=${GEMINI_API_KEY}")
  echo "   (Gemini AI 변환 포함 배포)"
fi
PARAMS=()
if [ ${#OVERRIDES[@]} -gt 0 ]; then
  PARAMS=(--parameter-overrides "${OVERRIDES[@]}")
fi
aws cloudformation deploy \
  --template-file backend/.packaged.yaml \
  --stack-name "${STACK}" \
  --capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND \
  --region "${REGION}" \
  ${PARAMS[@]+"${PARAMS[@]}"}

echo "4) 스택 출력값 조회..."
outputs=$(aws cloudformation describe-stacks --stack-name "${STACK}" --region "${REGION}" \
  --query 'Stacks[0].Outputs' --output json)
get() { echo "${outputs}" | grep -A1 "\"OutputKey\": \"$1\"" | grep OutputValue | sed 's/.*: "\(.*\)".*/\1/'; }

API_URL=$(get ApiBaseUrl)
POOL_ID=$(get UserPoolId)
CLIENT_ID=$(get UserPoolClientId)
TABLE=$(get TableName)

# 프론트 빌드용 환경변수 파일 (git 에는 올라가지 않음 — *.local)
cat > .env.production.local <<EOF
VITE_AWS_REGION=${REGION}
VITE_COGNITO_USER_POOL_ID=${POOL_ID}
VITE_COGNITO_CLIENT_ID=${CLIENT_ID}
VITE_API_BASE_URL=${API_URL}
EOF

echo
echo "완료 — 프론트 환경변수를 .env.production.local 에 기록했습니다:"
echo "  VITE_AWS_REGION=${REGION}"
echo "  VITE_COGNITO_USER_POOL_ID=${POOL_ID}"
echo "  VITE_COGNITO_CLIENT_ID=${CLIENT_ID}"
echo "  VITE_API_BASE_URL=${API_URL}"
echo "  (데이터 이전용 TABLE_NAME=${TABLE})"
echo
echo "다음 단계: bash scripts/deploy-aws.sh 로 프론트를 다시 빌드/배포하세요."
