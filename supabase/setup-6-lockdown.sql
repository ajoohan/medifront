-- ─────────────────────────────────────────────────────────────
-- 🔒 긴급 보안 패치 — RLS 정책 최소 권한으로 재설정
--
-- 문제: 기존 정책이 전 테이블에 `using (true)` / `with check (true)` 여서
--       공개 anon 키만으로 누구나 전체 데이터를 읽고·수정·삭제할 수 있었음.
--       (anon 키는 설계상 공개이며, 보호는 전적으로 RLS가 담당해야 함)
--
-- 원칙: 공개 사이트가 실제로 필요로 하는 동작만 허용하고 나머지는 전부 차단.
--   - articles / performances : 공개 읽기 (마케팅 콘텐츠, 개인정보 아님)
--   - consult_requests / inquiries : 공개 "쓰기만" (제출은 되지만 열람 불가)
--   - members : 로그인 회원이 "본인 행만" 열람
--   - member_logs / consults / operators : 전면 차단 (관리자 전용 데이터)
--
-- ⚠️ 이 패치 후 관리자 화면(/admin)의 데이터 조회·수정은 동작하지 않습니다.
--    현재 관리자 인증이 프론트엔드 전용(가짜)이라 DB에 증명할 신원이 없기 때문입니다.
--    AWS(Cognito + Lambda) 전환 전까지 관리자 작업은 Supabase 대시보드에서 수행하세요.
--
-- 참고: public.handle_new_user 트리거는 security definer 라서 RLS를 우회하므로
--       회원가입 시 members 자동 생성은 이 패치 후에도 정상 작동합니다.
--
-- 재실행 안전: 모든 정책을 drop 후 재생성합니다.
-- 실행: Supabase 대시보드 → SQL Editor → 붙여넣고 Run
-- ─────────────────────────────────────────────────────────────

-- RLS가 켜져 있는지 보장 (정책이 없으면 기본 거부)
alter table public.members          enable row level security;
alter table public.member_logs      enable row level security;
alter table public.inquiries        enable row level security;
alter table public.articles         enable row level security;
alter table public.consults         enable row level security;
alter table public.operators        enable row level security;
alter table public.consult_requests enable row level security;
alter table public.performances     enable row level security;

-- ── 1) 기존 전면개방 정책 제거 ────────────────────────────────
drop policy if exists "members_select"           on public.members;
drop policy if exists "members_insert"           on public.members;
drop policy if exists "members_update"           on public.members;
drop policy if exists "members_delete"           on public.members;
drop policy if exists "members_select_own"       on public.members;

drop policy if exists "member_logs_select"       on public.member_logs;
drop policy if exists "member_logs_insert"       on public.member_logs;
drop policy if exists "member_logs_update"       on public.member_logs;
drop policy if exists "member_logs_delete"       on public.member_logs;

drop policy if exists "inquiries_select"         on public.inquiries;
drop policy if exists "inquiries_insert"         on public.inquiries;
drop policy if exists "inquiries_update"         on public.inquiries;
drop policy if exists "inquiries_delete"         on public.inquiries;
drop policy if exists "inquiries_insert_public"  on public.inquiries;

drop policy if exists "articles_select"          on public.articles;
drop policy if exists "articles_insert"          on public.articles;
drop policy if exists "articles_update"          on public.articles;
drop policy if exists "articles_delete"          on public.articles;
drop policy if exists "articles_select_public"   on public.articles;

drop policy if exists "consults_select"          on public.consults;
drop policy if exists "consults_insert"          on public.consults;
drop policy if exists "consults_update"          on public.consults;
drop policy if exists "consults_delete"          on public.consults;

drop policy if exists "operators_select"         on public.operators;
drop policy if exists "operators_insert"         on public.operators;
drop policy if exists "operators_update"         on public.operators;
drop policy if exists "operators_delete"         on public.operators;

drop policy if exists "consult_requests_select"        on public.consult_requests;
drop policy if exists "consult_requests_insert"        on public.consult_requests;
drop policy if exists "consult_requests_update"        on public.consult_requests;
drop policy if exists "consult_requests_delete"        on public.consult_requests;
drop policy if exists "consult_requests_insert_public" on public.consult_requests;

drop policy if exists "performances_select"        on public.performances;
drop policy if exists "performances_insert"        on public.performances;
drop policy if exists "performances_update"        on public.performances;
drop policy if exists "performances_delete"        on public.performances;
drop policy if exists "performances_select_public" on public.performances;

-- ── 2) 공개 콘텐츠 — 읽기만 허용 ──────────────────────────────
-- 홈 '성과' 섹션 (src/components/Results.jsx)
create policy "performances_select_public" on public.performances
  for select to anon, authenticated using (true);

-- 매거진 (src/components/Magazine.jsx, MagazineDetailPage.jsx)
create policy "articles_select_public" on public.articles
  for select to anon, authenticated using (true);

-- ── 3) 공개 폼 — 제출(쓰기)만 허용, 열람 불가 ─────────────────
-- 무료 상담 신청 (src/components/Contact.jsx)
create policy "consult_requests_insert_public" on public.consult_requests
  for insert to anon, authenticated with check (true);

-- 1:1 문의 (src/components/InquiryModal.jsx) — 비회원 문의 허용
create policy "inquiries_insert_public" on public.inquiries
  for insert to anon, authenticated with check (true);

-- ── 4) 회원 본인 데이터만 열람 ────────────────────────────────
-- UserContext가 로그인 회원의 grade를 조회 (email 기준)
-- members 테이블에 auth.users 참조 컬럼이 없어 JWT의 email로 대조합니다.
create policy "members_select_own" on public.members
  for select to authenticated
  using ((auth.jwt() ->> 'email') = email);

-- ── 5) member_logs / consults / operators ────────────────────
-- 정책을 만들지 않음 = RLS 기본 거부 → anon·authenticated 모두 접근 불가.
--   (관리자 전용 데이터. AWS 전환 후 Lambda에서 권한 검사 예정)
