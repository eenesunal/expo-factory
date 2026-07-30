# modules/feed

Gönderi + yorum akışı. `likes` modülüne bağımlı (create.mjs otomatik ekler);
beğeni `entity_id = "post:<id>"` ad alanıyla entegre.

## APPLE GUIDELINE 1.2 — bu modülü kurduysan `moderation` da gerekli

Kullanıcı içeriği barındıran uygulamalar **raporlama ve engelleme mekanizması
olmadan review'dan geçmez**. `modules/moderation` bunu sağlıyor; kurmadan
submit etme.

Ayrıca gerekenler:
- Uygunsuz içeriği 24 saat içinde kaldırma taahhüdü (App Review notlarında yaz)
- Kullanım şartlarında (`docs/terms.html`) içerik kuralları

## Sayfalama: keyset, offset değil

`fetchPosts(cursor)` `created_at < cursor` ile ilerliyor. `OFFSET`/`range`
derin sayfalarda yavaşlar **ve** araya yeni gönderi girerse kayıt atlar veya
tekrarlar. Cursor olarak son gönderinin `created_at`'ini ver.

## Liste sayıları

Beğeni/yorum sayılarını **tek seferde** çek (`likeCounts`, `commentCounts`).
Her satır için ayrı sorgu atmak listeyi kilitler — `FeedScreen` bunu doğru
yapıyor, kopyalarken deseni koru.

## Ekranın eksik parçaları (kasıtlı)

`FeedScreen` sadece listeyi gösteriyor. Gönderi oluşturma formu, yorum ekranı
ve kullanıcı adı/avatar gösterimi her uygulamada farklı olduğu için
eklenmedi — `src/lib/feed.ts` içinde `createPost`, `fetchComments`,
`createComment`, `deletePost` hazır.

Kullanıcı adı/avatar göstermek istiyorsan `profiles` tablosuna
`display_name` ekle ve `posts` sorgusuna join et:
`.select("*, profiles(display_name, avatar_path)")` — ama `profiles`'ın RLS'i
şu an sadece kendi satırını okumaya izin veriyor, herkese açık bir görünüm
istiyorsan politika eklemen gerekir.

## Performans

`FlatList` yeterli. Binlerce satırda takılma görürsen `@shopify/flash-list`
kurup `FlatList`'i onunla değiştir (API neredeyse aynı) — önceden kurmuyoruz,
gerek olmayabilir.
