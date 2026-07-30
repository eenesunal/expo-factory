# modules/credits

Tüketilebilir kredi sistemi: havuz bazlı bakiye, atomik harcama/ekleme,
append-only denetim logu.

## Tablolar

- `credit_balances(user_id, pool, balance)` — asıl bakiye
- `credit_transactions(...)` — hareket logu + idempotency (`rc_transaction_id` UNIQUE)

Havuz (`pool`) serbest bir metin: `"default"`, `"image"`, `"export"`... Yeni bir
havuz eklemek migration gerektirmez. (Hafız'da bunlar `profiles` üstünde iki
sabit kolondu; genelleştirilirken satır bazlı hale getirildi.)

## Neden atomik RPC

`spend_credit` tek bir `UPDATE ... WHERE balance >= p_amount` yapar. "Oku, kontrol
et, yaz" akışı iki eşzamanlı istekte bakiyeyi eksiye düşürebilir; burada yarışı
veritabanı çözüyor. Yetersiz bakiyede `NULL` döner.

## GÜVENLİK: `spend_credit`/`add_credit` client'tan çağrılamaz

İkisi de `security definer` ve yalnızca `service_role`'e `grant`'lı. Client'a
açarsan kullanıcı kendi bakiyesini istediği kadar artırabilir. Kredili işlemleri
**edge function** içinden çalıştır:

```ts
const { data: remaining } = await supabase.rpc("spend_credit", {
  p_user_id: user.id, p_pool: "default", p_amount: 1,
});
if (remaining === null) return json({ error: "Kredi yetersiz" }, 429);

await supabase.from("credit_transactions")
  .insert({ user_id: user.id, pool: "default", amount: -1, reason: "spend" });

try {
  return json(await doTheWork());
} catch (err) {
  // İş başarısızsa krediyi GERİ VER — atlanırsa kullanıcı hatalı bir
  // istekte kredi kaybeder.
  await supabase.rpc("add_credit", { p_user_id: user.id, p_pool: "default", p_amount: 1 });
  throw err;
}
```

## İlk kredi

`grant_signup_credits()` trigger'ı yeni hesaba `('default', 5)` verir. Havuz
adlarını/miktarları `schema.sql` içindeki `values (...)` listesinde düzenle.

## Satın alma

Kredi satmak için `revenuecat` modülünü de kur — webhook satın almayı
`add_credit`'e çevirir. `src/lib/creditProducts.ts` ile webhook içindeki kopya
listeyi **senkron tutmayı unutma**.
