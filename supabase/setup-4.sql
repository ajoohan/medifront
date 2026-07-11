-- ─────────────────────────────────────────────────────────
-- 메디프론트 4차 설정: 상담 신청 접수 (메인 페이지 상담 신청 폼)
-- 실행 위치: Supabase 대시보드 > SQL Editor > New query > 붙여넣고 Run
-- ─────────────────────────────────────────────────────────

create table if not exists public.consult_requests (
  id bigint generated always as identity primary key,
  name text not null,
  phone text not null,
  specialty text not null default '',
  opening_period text not null default '',
  opening_region text not null default '',
  message text not null default '',
  status text not null default 'new', -- new(신규) | done(처리완료)
  created_at timestamptz not null default now()
);

alter table public.consult_requests enable row level security;

-- 방문자는 접수(insert)만 가능, 조회/변경/삭제는 관리자 화면에서 사용
-- ⚠️ 프로토타입 정책: anon 키 허용 (오픈 전 관리자 전용으로 제한할 것)
create policy "consult_requests_insert" on public.consult_requests for insert with check (true);
create policy "consult_requests_select" on public.consult_requests for select using (true);
create policy "consult_requests_update" on public.consult_requests for update using (true);
create policy "consult_requests_delete" on public.consult_requests for delete using (true);
