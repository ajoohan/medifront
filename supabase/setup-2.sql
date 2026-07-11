-- ─────────────────────────────────────────────────────────
-- 메디프론트 2차 설정: 전화 로그 + 1:1 문의 + 매거진 게시물
-- 실행 위치: Supabase 대시보드 > SQL Editor > New query > 붙여넣고 Run
-- ※ members-setup.sql 실행 이후에 실행할 것
-- ─────────────────────────────────────────────────────────

-- 1) 회원 전화 로그 (관리자 > 회원 상세)
create table if not exists public.member_logs (
  id bigint generated always as identity primary key,
  member_id bigint not null references public.members(id) on delete cascade,
  content text not null,
  logged_at timestamptz not null default now()
);

alter table public.member_logs enable row level security;

-- ⚠️ 프로토타입 정책: anon 키로 읽기/쓰기 허용 (오픈 전 관리자 전용으로 제한할 것)
create policy "member_logs_select" on public.member_logs for select using (true);
create policy "member_logs_insert" on public.member_logs for insert with check (true);
create policy "member_logs_update" on public.member_logs for update using (true);
create policy "member_logs_delete" on public.member_logs for delete using (true);

-- 2) 1:1 문의 — 회원이 작성, 관리자가 답변 (비공개)
create table if not exists public.inquiries (
  id bigint generated always as identity primary key,
  email text not null,
  name text not null default '',
  title text not null,
  content text not null,
  answer text,
  status text not null default 'open', -- open(답변대기) | answered(답변완료)
  created_at timestamptz not null default now(),
  answered_at timestamptz
);

alter table public.inquiries enable row level security;

create policy "inquiries_select" on public.inquiries for select using (true);
create policy "inquiries_insert" on public.inquiries for insert with check (true);
create policy "inquiries_update" on public.inquiries for update using (true);
create policy "inquiries_delete" on public.inquiries for delete using (true);

-- 3) 매거진 게시물 — 관리자 등록 글이 모든 방문자에게 표시됨
create table if not exists public.articles (
  id bigint generated always as identity primary key,
  title text not null,
  content text not null default '',
  thumbnail text,
  excerpt text not null default '',
  read text not null default '1분',
  status text not null default 'visible', -- visible | hidden
  category text,
  date date not null default current_date,
  created_at timestamptz not null default now()
);

alter table public.articles enable row level security;

create policy "articles_select" on public.articles for select using (true);
create policy "articles_insert" on public.articles for insert with check (true);
create policy "articles_update" on public.articles for update using (true);
create policy "articles_delete" on public.articles for delete using (true);
