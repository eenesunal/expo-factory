# modules/likes

Herhangi bir varlığı beğenilebilir yapar. Kendi tablona hiç dokunmaz —
`entity_id text` üzerinden çalışır.

## Kullanım

```tsx
<LikeButton entityId={`post:${post.id}`} count={counts[`post:${post.id}`]} />
```

Liste ekranında sayıları **tek seferde** çek, her satır için ayrı sorgu atma:

```ts
const counts = await likeCounts(posts.map((p) => `post:${p.id}`));
```

Birden fazla varlık türü beğenilebilir olacaksa `entity_id`'yi ad alanıyla
yaz (`"post:12"`, `"yorum:88"`) — tek bir tabloyla hepsi çalışır. (Bu, Hafız'da
`chapter,verse` çifti olan kolonların genelleştirilmiş hali.)

## Gizlilik

`likes` tablosunun RLS'i kullanıcıya **yalnızca kendi** beğenilerini gösterir.
Toplam sayılar `security definer` fonksiyonlarla (`like_counts`, `top_liked`)
sunuluyor: agregat döner, kimin beğendiği asla açığa çıkmaz.

## En çok beğenilenler

`topLiked()` sadece `entity_id` + sayı döner. Gösterilecek içeriği kendi
tablondan ayrıca çek:

```ts
const top = await topLiked(20);
const ids = top.map((t) => t.entityId.replace("post:", ""));
const { data: posts } = await supabase.from("posts").select("*").in("id", ids);
```

Beğeniden bağımsız, herhangi bir sayısal skora göre sıralama istiyorsan
`modules/leaderboard`'a bak.
