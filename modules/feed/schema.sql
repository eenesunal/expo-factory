create table if not exists posts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (length(trim(body)) between 1 and 2000),
  image_path text,
  created_at timestamptz not null default now()
);

-- Akış "en yeni önce" + keyset pagination (created_at < cursor) ile okunuyor.
create index if not exists posts_created_idx on posts (created_at desc, id desc);

alter table posts enable row level security;

drop policy if exists "Gönderiler herkese okunur" on posts;
create policy "Gönderiler herkese okunur"
  on posts for select
  using (true);

drop policy if exists "Kullanıcı kendi adına gönderi ekleyebilir" on posts;
create policy "Kullanıcı kendi adına gönderi ekleyebilir"
  on posts for insert
  with check (auth.uid() = user_id);

drop policy if exists "Kullanıcı kendi gönderisini silebilir" on posts;
create policy "Kullanıcı kendi gönderisini silebilir"
  on posts for delete
  using (auth.uid() = user_id);

create table if not exists comments (
  id bigint generated always as identity primary key,
  post_id bigint not null references posts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (length(trim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index if not exists comments_post_idx on comments (post_id, created_at);

alter table comments enable row level security;

drop policy if exists "Yorumlar herkese okunur" on comments;
create policy "Yorumlar herkese okunur"
  on comments for select
  using (true);

drop policy if exists "Kullanıcı kendi adına yorum ekleyebilir" on comments;
create policy "Kullanıcı kendi adına yorum ekleyebilir"
  on comments for insert
  with check (auth.uid() = user_id);

drop policy if exists "Kullanıcı kendi yorumunu silebilir" on comments;
create policy "Kullanıcı kendi yorumunu silebilir"
  on comments for delete
  using (auth.uid() = user_id);

-- Yorum sayılarını tek seferde çekmek için (liste ekranında N+1 sorgu yerine).
create or replace function public.comment_counts(p_post_ids bigint[])
returns table (post_id bigint, comment_count bigint)
language sql stable
as $$
  select c.post_id, count(*) from comments c
  where c.post_id = any(p_post_ids)
  group by c.post_id;
$$;

grant execute on function public.comment_counts(bigint[]) to anon, authenticated;
