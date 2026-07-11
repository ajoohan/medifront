-- ─────────────────────────────────────────────────────────
-- 메디프론트 3차 설정: 대면 상담 회의록 + 운영자 목록
-- 실행 위치: Supabase 대시보드 > SQL Editor > New query > 붙여넣고 Run
-- ─────────────────────────────────────────────────────────

-- 1) 대면 상담 회의록 (관리자 > 상담 관리 > 대면 상담)
create table if not exists public.consults (
  id bigint generated always as identity primary key,
  datetime text not null default '',
  place text not null default '',
  doctor_name text not null default '',
  doctor_phone text not null default '',
  doctor_email text not null default '',
  specialty text not null default '',
  region text not null default '',
  period text not null default '',
  content text not null default '',
  created_at timestamptz not null default now()
);

alter table public.consults enable row level security;

-- ⚠️ 프로토타입 정책: anon 키로 읽기/쓰기 허용 (오픈 전 관리자 전용으로 제한할 것)
create policy "consults_select" on public.consults for select using (true);
create policy "consults_insert" on public.consults for insert with check (true);
create policy "consults_update" on public.consults for update using (true);
create policy "consults_delete" on public.consults for delete using (true);

-- 2) 운영자 목록 (관리자 > 설정)
create table if not exists public.operators (
  id bigint generated always as identity primary key,
  name text not null default '',
  email text not null unique,
  phone text not null default '-',
  grade text not null default '매니저', -- 마스터 | 매니저
  created_at timestamptz not null default now()
);

alter table public.operators enable row level security;

create policy "operators_select" on public.operators for select using (true);
create policy "operators_insert" on public.operators for insert with check (true);
create policy "operators_update" on public.operators for update using (true);
create policy "operators_delete" on public.operators for delete using (true);
