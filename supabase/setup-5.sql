-- ─────────────────────────────────────────────────────────
-- 메디프론트 5차 설정: 성과 데이터 (홈페이지 '성과' 섹션 / 관리자 성과 관리)
-- 실행 위치: Supabase 대시보드 > SQL Editor > New query > 붙여넣고 Run
-- ─────────────────────────────────────────────────────────

create table if not exists public.performances (
  id bigint generated always as identity primary key,
  hospital text not null,               -- 병원명
  size text not null default '',         -- 평수 (예: 약380)
  opening_year int not null,             -- 개원시기(연도)
  created_at timestamptz not null default now()
);

alter table public.performances enable row level security;

-- ⚠️ 프로토타입 정책: anon 키로 읽기/쓰기 허용 (오픈 전 관리자 전용으로 제한할 것)
create policy "performances_select" on public.performances for select using (true);
create policy "performances_insert" on public.performances for insert with check (true);
create policy "performances_update" on public.performances for update using (true);
create policy "performances_delete" on public.performances for delete using (true);

-- 기존 홈페이지 성과 6건 시드 (중복 방지: 이미 있으면 건너뜀)
insert into public.performances (hospital, size, opening_year)
select v.hospital, v.size, v.opening_year
from (values
  ('강동*****의원', '약380', 2023),
  ('하남*****의원', '약450', 2022),
  ('세종*****의원', '약240', 2024),
  ('검단*****의원', '약280', 2023),
  ('제주*****의원', '약230', 2024),
  ('화정********의원', '약450', 2020)
) as v(hospital, size, opening_year)
where not exists (select 1 from public.performances);
