# modules/leaderboard

Herhangi bir sayısal skora göre sıralama. `likes`'ın beğeni-sayısına bağlı
olmayan, genel hali.

```ts
await submitScore(1250);                       // sadece daha iyiyse yazar
await submitScore(10, { mode: "add" });        // biriken puan
await submitScore(99, { board: "haftalik" });  // ayrı tablo
```

`board` kolonu farklı sıralamaları ayırır ("toplam", "haftalik", "seviye-3") —
her biri için ayrı tablo açmak gerekmez.

## HİLE: skor client'tan yazılıyor

`submit_score` `authenticated`'a açık; kullanıcı yalnızca **kendi** satırını
yazabilir ama **istediği değeri** yazabilir. Oyun/ödül gibi skorun kritik
olduğu bir yerde:

```sql
revoke execute on function public.submit_score(bigint, text, text) from authenticated;
```
ve skoru bir edge function içinden `service_role` ile yaz (sunucu tarafında
doğrulayarak).

## Kullanıcı adı gösterme

`top_scores` sadece `user_id` + skor döner. İsim/avatar için `profiles`'a
`display_name` ekle ve join et — ama `profiles`'ın RLS'i şu an yalnızca kendi
satırını okumaya izin veriyor, herkese açık bir okuma politikası eklemen
gerekir:

```sql
create policy "Görünen isimler herkese okunur"
  on profiles for select using (true);
```
Bunu yapmadan önce `profiles`'ta hassas bir kolon olmadığından emin ol.

## Haftalık sıfırlama

Bir cron/scheduled function ile:
```sql
delete from scores where board = 'haftalik';
```
Kalıcı bir arşiv istiyorsan silmeden önce başka bir tabloya kopyala.
