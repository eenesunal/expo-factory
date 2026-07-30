# modules/search

LLM'siz, ucuz metin arama. `rag` modülünün lexical yarısının bağımsız hali —
embedding maliyeti, edge function ve API key yok, sadece bir RPC.

```ts
const hits = await search(query);
```

## Kendi tablonu kullan

`search_items` tablosu bir kolaylık. Zaten aranabilir bir tablon varsa
(`posts`, `products`...) o tabloya trigram index'i ekleyip `search_text`
fonksiyonunu kendi kolonlarınla yaz, `search_items`'ı sil:

```sql
create index on posts using gin (body gin_trgm_ops);
```

`search_items` kullanacaksan kayıtları kendi verinle **senkron tutmayı
unutma** — `indexItem()` var ama çağırmayı sen hatırlayacaksın (ya da bir DB
trigger'ı yaz).

## Neden trigram, FTS değil

PostgreSQL'in dile özgü full-text stemmer'ları eklemeli dillerde (Türkçe gibi)
güvenilmez: kelimeleri anlamsız köklere indirgeyebiliyor ("yetim" → "yet").
Trigram morfolojiden bağımsız çalışır ve yazım hatalarına da toleranslı.

`similarity` yerine `word_similarity` kullanıyoruz: sorgu kelimesinin metin
**içindeki** en iyi eşleşmesini ölçer, tüm metinle karşılaştırmaz — uzun
içeriklerde şart.

## Eşikler

- Sorgu **3 karakterden kısaysa** hiç sorgu atılmıyor (trigram her şeye benzer).
- `word_similarity >= 0.3` — varsayılan 0.6 eklemeli dillerde çok katı.
- Başlık eşleşmesi 2x ağırlıklı (`search_text` içinde).

Sonuçlar alakasız geliyorsa ilk ayarlayacağın yer bu eşikler.
