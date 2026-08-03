#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────
# 메디프론트 프론트엔드 → AWS S3 + CloudFront 배포 스크립트
# 사전 준비: AWS CLI 설치 + `aws configure`로 자격증명 등록
# 사용: bash scripts/deploy-aws.sh
#
# ⚠️ 이 스크립트는 운영 중인 medifront.co.kr 을 덮어씁니다.
#    버킷 버저닝이 꺼져 있어 S3 자체 롤백이 불가능하므로, 되돌릴 일이 있으면
#    이전 배포본 백업에서 복구하세요:
#      aws s3 sync s3://medifront-backend-artifacts-156183795080/live-backup-20260716-supabase-version/ \
#                  s3://www.medifront.co.kr/ --delete
# ─────────────────────────────────────────────────────────
set -euo pipefail

# 운영 리소스 (CloudFront E28RDEJMWF0QSJ → 별칭 medifront.co.kr / www.medifront.co.kr)
BUCKET="www.medifront.co.kr"           # 배포 원본 S3 버킷 (us-east-1)
DISTRIBUTION_ID="E28RDEJMWF0QSJ"       # 운영 CloudFront 배포 ID

echo "1) 프로덕션 빌드..."
npm run build

echo "2) S3 업로드 (기존 파일과 동기화, 삭제 반영)..."

# ── 캐시 정책 ───────────────────────────────────────────────────────
# assets/ 안의 파일만 영구 캐시한다. Vite 가 내용이 바뀌면 파일명(해시)을 바꿔 주므로
# 브라우저가 옛 파일을 붙들고 있어도 새 이름을 새로 받아 문제가 없다.
#
# ⚠️ 그 외(HTML·robots.txt·sitemap.xml·이미지·PDF)는 이름이 고정이다. 여기에
# immutable 을 걸면 브라우저가 1년 동안 재확인조차 하지 않아, CloudFront 를 비워도
# 방문자 화면은 옛날 그대로 남는다. 실제로 컨설팅 자료를 고쳤는데 예전 버튼이 계속
# 보이는 일이 있었다. 이 파일들은 no-cache(쓰기 전 서버에 확인)로 올린다.
# ────────────────────────────────────────────────────────────────────
aws s3 sync dist/assets/ "s3://${BUCKET}/assets/" --delete \
  --cache-control "public,max-age=31536000,immutable"

aws s3 sync dist/ "s3://${BUCKET}/" --delete \
  --exclude "assets/*" \
  --cache-control "no-cache"

# /admin 전용 OG 카드 — 확장자 없는 오브젝트라 Content-Type 을 명시해야 브라우저가 렌더함
aws s3 cp dist/admin "s3://${BUCKET}/admin" \
  --content-type "text/html" \
  --cache-control "no-cache"

echo "3) CloudFront 캐시 무효화..."
aws cloudfront create-invalidation \
  --distribution-id "${DISTRIBUTION_ID}" \
  --paths "/*" >/dev/null

echo "완료 — 몇 분 뒤 https://medifront.co.kr 에 반영됩니다."
