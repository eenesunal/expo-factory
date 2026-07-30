-- Kullanıcı profili. Her yeni auth.users kaydı için trigger'la otomatik
-- oluşturulur. Uygulamaya özel kolonları (display_name, avatar_url vb.)
-- buraya `alter table ... add column if not exists` ile ekle — `create table
-- if not exists` var olan tabloya yeni kolon EKLEMEZ.
create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

drop policy if exists "Kullanıcılar kendi profilini görebilir" on profiles;
create policy "Kullanıcılar kendi profilini görebilir"
  on profiles for select
  using (auth.uid() = id);

drop policy if exists "Kullanıcılar kendi profilini güncelleyebilir" on profiles;
create policy "Kullanıcılar kendi profilini güncelleyebilir"
  on profiles for update
  using (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
