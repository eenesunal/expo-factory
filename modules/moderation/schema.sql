-- Moderatör bayrağı. Kendi hesabını elle işaretle:
--   update profiles set is_moderator = true where id = '<user-id>';
alter table profiles add column if not exists is_moderator boolean not null default false;

-- İçerik raporları. `target_type` + `target_id` serbest metin — hangi tabloyu
-- raporladığın bu modülü ilgilendirmiyor ("post", "comment", "message", "user").
create table if not exists reports (
  id bigint generated always as identity primary key,
  reporter_id uuid not null references auth.users (id) on delete cascade,
  target_type text not null,
  target_id text not null,
  reason text not null check (length(trim(reason)) between 1 and 500),
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  -- Aynı kullanıcı aynı içeriği iki kez raporlayamaz (spam koruması).
  unique (reporter_id, target_type, target_id)
);

create index if not exists reports_status_idx on reports (status, created_at);

alter table reports enable row level security;

drop policy if exists "Kullanıcı kendi raporlarını görebilir" on reports;
create policy "Kullanıcı kendi raporlarını görebilir"
  on reports for select
  using (
    auth.uid() = reporter_id
    or exists (select 1 from profiles p where p.id = auth.uid() and p.is_moderator)
  );

drop policy if exists "Kullanıcı rapor oluşturabilir" on reports;
create policy "Kullanıcı rapor oluşturabilir"
  on reports for insert
  with check (auth.uid() = reporter_id);

drop policy if exists "Moderatörler raporu güncelleyebilir" on reports;
create policy "Moderatörler raporu güncelleyebilir"
  on reports for update
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_moderator));

-- Kullanıcı engelleme. Apple Guideline 1.2 raporlamanın YANINDA engellemeyi de
-- istiyor — sadece rapor yeterli değil.
create table if not exists blocks (
  blocker_id uuid not null references auth.users (id) on delete cascade,
  blocked_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

alter table blocks enable row level security;

drop policy if exists "Kullanıcı kendi engellerini yönetir" on blocks;
create policy "Kullanıcı kendi engellerini yönetir"
  on blocks for all
  using (auth.uid() = blocker_id)
  with check (auth.uid() = blocker_id);

-- Engellenen kullanıcıların içeriğini filtrelemek için. Listeleme
-- sorgularında kullan:
--   .not("user_id", "in", `(${(await blockedUserIds()).join(",")})`)
-- ya da doğrudan SQL'de: where user_id not in (select blocked_id from blocks where blocker_id = auth.uid())
create or replace function public.blocked_user_ids()
returns setof uuid
language sql stable
security definer
set search_path = public
as $$
  select blocked_id from blocks where blocker_id = auth.uid();
$$;

grant execute on function public.blocked_user_ids() to authenticated;
