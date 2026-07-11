-- ─────────────────────────────────────────────────────────
-- 메디프론트 회원 목록 테이블 (관리자 > 회원관리 실데이터)
-- 실행 위치: Supabase 대시보드 > SQL Editor > New query > 붙여넣고 Run
-- ─────────────────────────────────────────────────────────

create table if not exists public.members (
  id bigint generated always as identity primary key,
  name text not null default '',
  email text not null unique,
  phone text not null default '-',
  hospital text not null default '-',
  specialty text not null default '-',
  grade text not null default '일반',
  status text not null default 'active',
  joined_at date not null default current_date,
  created_at timestamptz not null default now()
);

alter table public.members enable row level security;

-- ⚠️ 프로토타입 정책: anon 키로 읽기/쓰기 전부 허용
--    정식 오픈 전 반드시 관리자 전용(authenticated + 관리자 판별)으로 제한할 것
create policy "members_select" on public.members for select using (true);
create policy "members_insert" on public.members for insert with check (true);
create policy "members_update" on public.members for update using (true);
create policy "members_delete" on public.members for delete using (true);

-- 회원가입(이메일 가입·관리자 수동 추가 모두) 시 목록에 자동 등록
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.members (name, email, phone, grade)
  values (
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    coalesce(new.raw_user_meta_data->>'phone', '-'),
    coalesce(new.raw_user_meta_data->>'grade', '일반')
  )
  on conflict (email) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
