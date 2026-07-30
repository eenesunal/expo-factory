-- Skorlar. `board` farklı sıralama tablolarını ayırır ("toplam", "haftalik",
-- "seviye-3") — her biri için ayrı tablo açmak gerekmiyor.
create table if not exists scores (
  user_id uuid not null references auth.users (id) on delete cascade,
  board text not null default 'default',
  score bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, board)
);

create index if not exists scores_board_idx on scores (board, score desc);

alter table scores enable row level security;

-- Sıralama listesi `top_scores` (security definer) ile sunuluyor; tablonun
-- kendi RLS'i kullanıcıya sadece kendi satırını gösteriyor.
drop policy if exists "Kullanıcılar kendi skorunu görebilir" on scores;
create policy "Kullanıcılar kendi skorunu görebilir"
  on scores for select
  using (auth.uid() = user_id);

-- Skoru yazar. p_mode:
--   'max' (varsayılan) — yalnızca daha iyiyse günceller (yüksek skor tablosu)
--   'set'              — koşulsuz yazar
--   'add'              — mevcut skora ekler (biriken puan)
create or replace function public.submit_score(
  p_score bigint,
  p_board text default 'default',
  p_mode text default 'max'
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  final_score bigint;
begin
  if uid is null then
    raise exception 'Oturum gerekli';
  end if;
  if p_mode not in ('max', 'set', 'add') then
    raise exception 'geçersiz mod: %', p_mode;
  end if;

  insert into scores (user_id, board, score, updated_at)
  values (uid, p_board, p_score, now())
  on conflict (user_id, board) do update
    set score = case p_mode
          when 'max' then greatest(scores.score, excluded.score)
          when 'add' then scores.score + excluded.score
          else excluded.score
        end,
        updated_at = now()
  returning score into final_score;

  return final_score;
end;
$$;

grant execute on function public.submit_score(bigint, text, text) to authenticated;

-- Sıralama listesi. Kullanıcı id'sini döndürüyor ama başka bir kişisel veri
-- döndürmüyor — isim/avatar göstermek istersen profiles ile join et ve
-- profiles'a herkese açık bir okuma politikası ekle.
create or replace function public.top_scores(p_board text default 'default', p_limit int default 20)
returns table (rank bigint, user_id uuid, score bigint)
language sql stable
security definer
set search_path = public
as $$
  select row_number() over (order by s.score desc, s.updated_at asc) as rank,
         s.user_id, s.score
  from scores s
  where s.board = p_board
  order by rank
  limit p_limit;
$$;

grant execute on function public.top_scores(text, int) to anon, authenticated;

-- Kullanıcının kendi sırası — ilk 20'de olmasa da gösterilebilsin.
create or replace function public.my_rank(p_board text default 'default')
returns table (rank bigint, score bigint)
language sql stable
security definer
set search_path = public
as $$
  select (select count(*) + 1 from scores s2
          where s2.board = p_board and s2.score > s.score) as rank,
         s.score
  from scores s
  where s.board = p_board and s.user_id = auth.uid();
$$;

grant execute on function public.my_rank(text) to authenticated;
