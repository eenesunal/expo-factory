# modules/moderation

Kullanıcı içeriğini raporlama + kullanıcı engelleme.

## NEDEN ZORUNLU

**Apple Guideline 1.2:** kullanıcı içeriği (gönderi, yorum, mesaj, profil
fotoğrafı) barındıran uygulamalar şunlar olmadan review'dan **geçmez**:

1. İçeriği raporlama mekanizması
2. Kullanıcıyı **engelleme** mekanizması (rapor tek başına yeterli değil)
3. Uygunsuz içeriği 24 saat içinde kaldırma taahhüdü

`feed`, `realtime-chat` ya da `file-upload` kurduysan bu modül de gerekli.
App Review notlarına 3. maddeyi **açıkça yaz** — Apple bunu arıyor.

## Kullanım

```tsx
<ReportButton target={{ type: "post", id: String(post.id) }} authorId={post.user_id} />
```

Liste sorgularında engellenenleri filtrele:

```ts
const blocked = await blockedUserIds();
let query = supabase.from("posts").select("*");
if (blocked.length > 0) query = query.not("user_id", "in", `(${blocked.join(",")})`);
```

Engelleme yalnızca **gösterimi** etkiler, veri silinmez — Apple'ın istediği de
bu.

## ADMİN PANELİ KURMA

Raporları **Supabase Studio > Table Editor > reports** üzerinden elle incele.
Ayrı bir admin paneli yazmak, gerçekten günde onlarca rapor gelene kadar zaman
kaybı. `status` kolonunu (`open`/`resolved`/`dismissed`) Studio'dan
güncelleyebilirsin.

Kendini moderatör yap:
```sql
update profiles set is_moderator = true where id = '<senin-user-id>';
```
`is_moderator` sadece raporları okuma/güncelleme yetkisi verir; içerik silme
işini Studio'dan ya da `service_role` ile yap.

## Spam koruması

`reports` tablosunda `unique (reporter_id, target_type, target_id)` var — aynı
kullanıcı aynı içeriği iki kez raporlayamaz. Client bunu hata olarak
göstermiyor, "aldık" diyor (kullanıcı zaten raporladığını bilmek zorunda değil).
