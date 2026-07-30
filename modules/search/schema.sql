create extension if not exists pg_trgm;

-- Aranabilir kayıtlar. ZATEN aranabilir bir tablon varsa bu tabloya ihtiyacın
-- yok — aşağıdaki `search_text` fonksiyonunu kendi tablonun adı/kolonlarıyla
-- düzenle ve bu tabloyu sil.
create table if not exists search_items (
  entity_id text primary key,
  title text not null,
  content text,
  updated_at timestamptz not null default now()
);

-- İki ayrı GIN index: başlık eşleşmesi içerik eşleşmesinden daha ağırlıklı
-- puanlanıyor (aşağıya bak), ikisi de index'ten faydalanmalı.
create index if not exists search_items_title_trgm_idx
  on search_items using gin (title gin_trgm_ops);
create index if not exists search_items_content_trgm_idx
  on search_items using gin (content gin_trgm_ops);

alter table search_items enable row level security;

drop policy if exists "Arama kayıtları herkese okunur" on search_items;
create policy "Arama kayıtları herkese okunur"
  on search_items for select
  using (true);

-- Trigram benzerliğiyle arama. FTS (to_tsvector) yerine trigram:
-- PostgreSQL'in dile özgü stemmer'ları eklemeli dillerde (Türkçe gibi)
-- güvenilmez — kelimeleri anlamsız köklere indirgeyebiliyor. Trigram
-- morfolojiden bağımsız çalışır ve yazım hatalarına da toleranslıdır.
--
-- word_similarity (similarity değil): sorgu kelimesinin metin İÇİNDEKİ en iyi
-- eşleşmesini ölçer, tüm metinle karşılaştırmaz — uzun içeriklerde şart.
create or replace function public.search_text(p_query text, p_limit int default 20)
returns table (entity_id text, title text, content text, score double precision)
language sql stable
as $$
  select s.entity_id, s.title, s.content,
    -- Başlık eşleşmesi 2x ağırlıklı.
    (2 * word_similarity(p_query, s.title) + word_similarity(p_query, coalesce(s.content, '')))::double precision as score
  from search_items s
  where word_similarity(p_query, s.title) >= 0.3
     or word_similarity(p_query, coalesce(s.content, '')) >= 0.3
  order by score desc, s.title
  limit p_limit;
$$;

grant execute on function public.search_text(text, int) to anon, authenticated;
