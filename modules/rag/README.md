# modules/rag

Kendi belge korpusuna dayalı soru-cevap: hibrit arama (embedding + trigram,
Reciprocal Rank Fusion ile birleştirilmiş) + sadece bulunan kaynaklara dayanan
LLM cevabı + cevap cache'i.

Sadece arama istiyorsan (LLM'siz, ucuz) `modules/search`'e bak.

## Veri modeli

```
rag_documents(entity_id, category, reference_label, content, sort_key, embedding)
```

- `entity_id` — kendi kaynağındaki kararlı kimlik (SKU, "2:153", UUID...).
  LLM cevabında **bunu** geri ister.
- `reference_label` — insan-okunur etiket ("Bakara, 153. ayet", "Moda Sahili").
  LLM'e hiç gösterilmez, biz DB'den okuruz.
- `category` — "bu kategorinin tamamı" akışı için (aşağıya bak).

## TUZAK #6: LLM'in serbest metin alanlarına GÜVENME

Bir LLM'e "referans" gibi insan-formatlı bir alan yazdırırsan bazen halüsinasyon
yapıp var olmayan bir isim uydurur. Bu yüzden şema **sadece `entity_ids`**
istiyor (modelin context'inde geçen etiketten kopyalayacağı yapısal veri);
insan-okunur etiketi `rag_documents`'tan deterministik olarak biz üretiyoruz.
Dönen id'ler ayrıca korpusla kesiştiriliyor — uydurulmuş bir id sessizce düşer.

## TUZAK #7: cache'lenmiş cevapların şekli zamanla değişir

Response şemasına yeni bir alan eklersen eskiden cache'lenmiş satırlar o alanı
içermez ve client'ta "undefined" kırılmaları olur. `isCachedAnswerValid()`
cache'i okumadan önce şekli doğruluyor; uymuyorsa cache atlanıp cevap yeniden
üretiliyor. **Şemayı değiştirdiğinde bu fonksiyonu da güncelle.**

Ayrıca cache yalnızca `entity_ids` + `commentary` tutuyor, metnin kendisini
değil — korpusu güncellediğinde eski cevaplar da güncel metni gösterir.

## Neden hibrit arama

Saf embedding araması, soru cümlesi ile doğrudan ifade içeren belge arasında
(asymmetric search) zayıf kalıyor. Lexical (trigram) taraf, sorudaki anahtar
kelimenin geçtiği belgeleri garanti eder. `match_documents` ikisini RRF ile
birleştiriyor.

Kalite ayarları (`schema.sql` içinde, hepsi sert yoldan öğrenildi):

- **Stopword listesi** — soru kalıpları ("nasıl", "için") kısa ve yaygın oldukları
  için trigram eşleşmede asıl konudan yüksek skor alır. En önemli ayar bu;
  kendi diline/alanına göre gözden geçir.
- **Yaygınlık filtresi** — 150'den fazla belgede geçen kelimeler eleniyor
  (yaygın bir kelime tek başına sıralamayı ele geçiriyordu). Eşik ~6000 belgeye
  göre; korpus boyutuna göre ölçekle.
- **Yaygınlığı `ilike` ile sayıyoruz**, `word_similarity` ile değil — fuzzy sayım
  gerçekten ayırt edici bir kelimeyi yanlışlıkla "yaygın" sayıyordu.
- **Her anahtar kelime kendi 50'lik penceresini alır** — ortak LIMIT'te yaygın
  bir kelimenin tam eşleşmeleri nadir kelimenin sonuçlarını tamamen dışarıda
  bırakıyordu.
- **`word_similarity >= 0.3`** açıkça yazılı (varsayılan 0.6 eklemeli dillerde
  çok katı; Supabase bu GUC'u `ALTER FUNCTION ... SET` ile değiştirmeye izin
  vermiyor).
- **Anahtar kelime çıkarma LLM'i** — soru günlük dille yazılır, korpus başka
  üslupta olabilir. Çıkarılan kelimeler orijinal soruyla **birleştirilmez**
  (gramer ekleri geri karışıp kirliliği yeniden yaratıyor). Embedding için
  orijinal soru kullanılır.

## "Bu kategorinin tamamı" akışı

"X koleksiyonunda neler var" gibi sorular tekil benzerlik aramasıyla çözülmüyor:
kategori adı belgelerin içinde geçmez, vektör araması alakasız belgeler bulur ve
LLM haklı olarak `found:false` döner. `detectCategory()` sorunun bir kategoriyi
işaret ettiğini anlarsa o kategorinin **tüm** belgelerini doğrudan çeker.
Kategorileri kullanmıyorsan (`category` hep null) bu akış kendiliğinden devre
dışı kalır.

## Kurulum

```bash
supabase secrets set OPENAI_API_KEY=... ANTHROPIC_API_KEY=...
# opsiyonel, `credits` modülü kuruluysa:
supabase secrets set RAG_CREDIT_POOL=default

node scripts/embed-documents.mjs documents.json   # bkz. documents.example.json
supabase functions deploy ask-question
```

Veri yüklendikten **sonra** HNSW index'ini oluştur — boş tabloda oluşturulan
index kötü performans verir (`schema.sql`'in son satırı).

**API key'leri EAS'a koymayın.** `OPENAI_API_KEY`/`ANTHROPIC_API_KEY` sadece
`supabase secrets` içinde durur; `EXPO_PUBLIC_*` olan her şey uygulama
binary'sine gömülür.

## Maliyet

- Embedding: `text-embedding-3-small`, ~1000 belge birkaç sent (bir kez).
- Soru başına: 1 embedding + 2 küçük Haiku çağrısı (anahtar kelime + kategori
  algılama) + 1 cevap çağrısı. Cache aynı soruyu ikinci kez ücretsiz yapar.
