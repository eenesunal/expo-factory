create extension if not exists vector;
-- pg_trgm: PostgreSQL'in dile özgü full-text stemmer'ları eklemeli dillerde
-- (Türkçe gibi) güvenilmez — örn. "yetim" kelimesini "yet" köküne indirgeyip
-- anlamsızlaştırıyor. Trigram tabanlı word_similarity morfolojiye bağımlı
-- olmadığı için bu sorunu bypass eder.
create extension if not exists pg_trgm;

-- Aranabilir belgeler. `entity_id` senin kendi kaynağındaki kararlı kimlik
-- (ürün SKU'su, "2:153", bir UUID...) — LLM cevabında bu ID'yi geri ister,
-- insan-okunur etiketi (`reference_label`) BİZ buradan deterministik olarak
-- okuruz (bkz. TUZAK #6, README).
-- `category`, "bu kategorinin tamamını sor" akışı için (README).
create table if not exists rag_documents (
  id bigint generated always as identity primary key,
  entity_id text not null unique,
  category text,
  reference_label text not null,
  content text not null,
  sort_key int,
  embedding vector(1536)
);

create index if not exists rag_documents_category_idx on rag_documents (category, sort_key);
create index if not exists rag_documents_content_trgm_idx
  on rag_documents using gin (content gin_trgm_ops);

alter table rag_documents enable row level security;

drop policy if exists "Belgeler herkese okunur" on rag_documents;
create policy "Belgeler herkese okunur"
  on rag_documents for select
  using (true);

-- Semantic (embedding) + lexical (trigram) aramayı Reciprocal Rank Fusion ile
-- birleştirir; ikisinden en az birinde üst sıralarda çıkan belgeler öne geçer.
--
-- Saf embedding araması, soru cümlesi ile doğrudan ifade içeren belge arasında
-- (asymmetric search) zayıf kalabiliyor — lexical taraf, sorudaki anahtar
-- kelimenin geçtiği belgeleri garanti eder.
create or replace function match_documents(
  query_embedding vector(1536),
  query_text text,
  match_count int default 15
)
returns table (
  entity_id text,
  reference_label text,
  content text,
  score double precision
)
language sql stable
as $$
  with raw_kw as (
    select array(
      select distinct trim(both '?!.,;:''"()[]' from w)
      from unnest(regexp_split_to_array(lower(query_text), '\s+')) as w
      where length(trim(both '?!.,;:''"()[]' from w)) >= 4
        -- Soru kalıpları ("nasıl", "için") ve soru ekleri kısa/yaygın oldukları
        -- için trigram eşleşmede asıl konudan daha yüksek skor alabiliyor.
        -- BU LİSTE arama kalitesinin en önemli ayarı — kendi dilin ve alan
        -- adın için gözden geçir.
        and trim(both '?!.,;:''"()[]' from w) not in (
          'nasıl', 'neden', 'niçin', 'niye', 'hangi', 'kimden', 'kime', 'kimin',
          'için', 'gibi', 'kadar', 'daha', 'olarak', 'diye', 'yani',
          'ancak', 'fakat', 'ama', 'veya', 'yahut', 'hakkında', 'konusunda',
          'üzerine', 'üzerinde', 'bunlar', 'şunlar', 'onlar', 'bize', 'size',
          'onun', 'bunun', 'şunun', 'değil', 'diyor', 'diyoruz'
        )
        and trim(both '?!.,;:''"()[]' from w) !~ '(mal[ıi]y[ıi]z|mel[ıi]y[ıi]z)$'
    ) as keywords
  ),
  -- Yüzlerce belgede geçen kelimeler tek başlarına hiçbir şeyi ayırt etmiyor ve
  -- max-skorla sıralamayı ele geçiriyor. Yaygınlığı word_similarity yerine düz
  -- substring sayımıyla ölçüyoruz — trigram tabanlı fuzzy sayım güvenilmez
  -- (gerçekten ayırt edici bir kelime, kısmi trigram çakışmalarından ötürü
  -- yüzlerce alakasız belgeye "benziyor" görünüp yanlışlıkla yaygın sayılıyor).
  -- 150 eşiği ~6000 belgeye göre; kendi korpus boyutuna göre ölçekle.
  kw as (
    select array(
      select k from unnest((select keywords from raw_kw)) as k
      where (select count(*) from rag_documents d where d.content ilike '%' || k || '%') <= 150
    ) as keywords
  ),
  semantic as (
    select d.entity_id, d.reference_label, d.content,
      row_number() over (order by d.embedding <=> query_embedding) as rnk
    from rag_documents d
    where d.embedding is not null
    order by d.embedding <=> query_embedding
    limit 50
  ),
  -- Her anahtar kelime KENDİ 50'lik sıralama penceresini alır. Tek bir MAX
  -- skorla birleştirmek, yaygın bir kelimenin onlarca tam eşleşmesinin ortak
  -- LIMIT'i doldurup nadir/ayırt edici bir kelimenin sonuçlarını tamamen
  -- dışarıda bırakmasına yol açıyordu (eşit skorlu 1.0 satırlar arasında
  -- sıralama kırılımı olmadığı için).
  lexical_scored as (
    select d.entity_id, d.reference_label, d.content, kwu.ord as kw_idx,
      word_similarity(kwu.k, d.content) as sim
    from rag_documents d
    cross join kw
    cross join lateral unnest(kw.keywords) with ordinality as kwu(k, ord)
    -- pg_trgm.word_similarity_threshold varsayılanı (0.6) eklemeli dillerde çok
    -- katı: aynı kökü paylaşan ama eki farklı kelimeler eşleşemiyor. 0.3'e
    -- sabitliyoruz (Supabase'in barındırılan Postgres'i bu GUC'u
    -- ALTER FUNCTION ... SET ile değiştirmeye izin vermiyor, koşulu açık yazıyoruz).
    where word_similarity(kwu.k, d.content) >= 0.3
  ),
  lexical_ranked as (
    select entity_id, reference_label, content, kw_idx,
      row_number() over (partition by kw_idx order by sim desc) as rnk
    from lexical_scored
  ),
  lexical as (
    select entity_id, max(reference_label) as reference_label, max(content) as content,
      sum(1.0 / (60 + rnk)) as score
    from lexical_ranked
    where rnk <= 50
    group by entity_id
  )
  select
    coalesce(s.entity_id, l.entity_id),
    coalesce(s.reference_label, l.reference_label),
    coalesce(s.content, l.content),
    (coalesce(1.0 / (60 + s.rnk), 0) + coalesce(l.score, 0))::double precision
  from semantic s
  full outer join lexical l on s.entity_id = l.entity_id
  order by 4 desc
  limit match_count;
$$;

grant execute on function match_documents(vector, text, int) to service_role;

-- Cevap geçmişi + cache. question_normalized, aynı soru tekrar sorulduğunda
-- LLM'e gitmeden önceki cevabı bulmak için (boşluk/büyük-küçük harf farklarını
-- yok sayarak).
create table if not exists rag_answers (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  question text not null,
  question_normalized text generated always as (
    lower(trim(regexp_replace(question, '\s+', ' ', 'g')))
  ) stored,
  entity_ids jsonb not null default '[]'::jsonb,
  commentary text,
  not_found boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists rag_answers_user_created_idx on rag_answers (user_id, created_at);
create index if not exists rag_answers_normalized_idx on rag_answers (question_normalized);

alter table rag_answers enable row level security;

drop policy if exists "Kullanıcılar kendi sorularını görebilir" on rag_answers;
create policy "Kullanıcılar kendi sorularını görebilir"
  on rag_answers for select
  using (auth.uid() = user_id);

-- VERİ YÜKLENDİKTEN SONRA çalıştır — boş tabloda oluşturulan HNSW index'i
-- kötü performans verir. (Bu satırı ilk şema kurulumunda atlamak güvenli;
-- embed-documents.mjs bittikten sonra elle çalıştır.)
create index if not exists rag_documents_embedding_idx
  on rag_documents using hnsw (embedding vector_cosine_ops);
