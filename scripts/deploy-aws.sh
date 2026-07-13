#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────
# 메디프론트 프론트엔드 → AWS S3 + CloudFront 배포 스크립트
# 사전 준비: AWS CLI 설치 + `aws configure`로 자격증명 등록
# 사용: BUCKET / DISTRIBUTION_ID 를 본인 값으로 채운 뒤 실행
#   bash scripts/deploy-aws.sh
# ─────────────────────────────────────────────────────────
set -euo pipefail

# ▼▼▼ 본인 리소스 값으로 교체 ▼▼▼
BUCKET="medifront-co-kr-web"          # 새로 만든 S3 버킷명 (기존 사이트 버킷과 달라야 함)
DISTRIBUTION_ID="XXXXXXXXXXXXXX"      # 새로 만든 CloudFront 배포 ID
# ▲▲▲ 여기까지 ▲▲▲

echo "1) 프로덕션 빌드..."
npm run build

echo "2) S3 업로드 (기존 파일과 동기화, 삭제 반영)..."
# 정적 에셋은 오래 캐시, index.html 은 항상 최신
aws s3 sync dist/ "s3://${BUCKET}/" --delete \
  --exclude "index.html" \
  --cache-control "public,max-age=31536000,immutable"
aws s3 cp dist/index.html "s3://${BUCKET}/index.html" \
  --cache-control "no-cache"

echo "3) CloudFront 캐시 무효화..."
aws cloudfront create-invalidation \
  --distribution-id "${DISTRIBUTION_ID}" \
  --paths "/*" >/dev/null

echo "완료 — 몇 분 뒤 https://medifront.co.kr 에 반영됩니다."
