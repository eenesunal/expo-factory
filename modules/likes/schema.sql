-- Beğeniler. `entity_id` serbest bir metin: hangi tablodan/ID'den olduğu bu
-- modülü ilgilendirmiyor. Birden fazla varlık türü için ad alanı kullan
-- ("post:12", "kart:af-9").
create table if not exists likes (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  entity_id text not null,
  created_at timestamptz not null default now(),
  unique (user_id, entity_id)
);

create index if not exists likes_entity_idx on likes (entity_id);

alter table likes enable row level security;

-- Kullanıcı YALNIZCA kendi beğenilerini görebilir — toplam sayılar aşağıdaki
-- security definer fonksiyonlarla, kimin beğendiğini açığa çıkarmadan sunuluyor.
drop policy if exists "Kullanıcılar kendi beğenilerini görebilir" on likes;
create policy "Kullanıcılar kendi beğenilerini görebilir"
  on likes for select
  using (auth.uid() = user_id);

-- Beğeniyi açar/kapatır, atomik. true = artık beğenilmiş, false = kaldırıldı.
create or replace function public.toggle_like(p_entity_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  existing_id bigint;
begin
  if uid is null then
    raise exception 'Oturum gerekli';
  end if;

  select id into existing_id from likes where user_id = uid and entity_id = p_entity_id;

  if existing_id is not null then
    delete from likes where id = existing_id;
    return false;
  end if;

  insert into likes (user_id, entity_id) values (uid, p_entity_id);
  return true;
end;
$$;

grant execute on function public.toggle_like(text) to authenticated;

create or replace function public.is_liked(p_entity_id text)
returns boolean
language sql stable
security definer
set search_path = public
as $$
  select exists(select 1 from likes where user_id = auth.uid() and entity_id = p_entity_id);
$$;

grant execute on function public.is_liked(text) to authenticated;

-- Bir liste ekranı için tek seferde tüm sayılar (N+1 sorgu yerine).
create or replace function public.like_counts(p_entity_ids text[])
returns table (entity_id text, like_count bigint)
language sql stable
security definer
set search_path = public
as $$
  select l.entity_id, count(*) as like_count
  from likes l
  where l.entity_id = any(p_entity_ids)
  group by l.entity_id;
$$;

grant execute on function public.like_counts(text[]) to anon, authenticated;

-- "En çok beğenilenler" — sadece agregat döner (security definer, likes'ın
-- RLS'ini bypass eder ama kimin beğendiğini göstermez).
create or replace function public.top_liked(p_limit int default 20)
returns table (entity_id text, like_count bigint)
language sql stable
security definer
set search_path = public
as $$
  select l.entity_id, count(*) as like_count
  from likes l
  group by l.entity_id
  order by like_count desc, l.entity_id
  limit p_limit;
$$;

grant execute on function public.top_liked(int) to anon, authenticated;
