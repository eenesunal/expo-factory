# modules/referral

Davet kodu + karşılıklı ödül. `credits` modülüne bağımlı (create.mjs otomatik
ekler).

```ts
const code = await getMyReferralCode();          // paylaşılacak kod
const { reward, error } = await redeemReferral(input);
```

Her yeni hesaba trigger'la otomatik 8 karakterli bir kod atanır (karışabilecek
karakterler — 0/O, 1/I/L — alfabeden çıkarıldı, kod elle de yazılabiliyor).

## Ödül miktarları

`schema.sql` > `redeem_referral` içindeki sabitler:

```sql
reward_invitee constant int := 10;   -- kodu kullanan
reward_inviter constant int := 10;   -- kodu paylaşan
reward_pool    constant text := 'default';
```

## Kötüye kullanım

`redeem_referral` tek bir yerde üç şeyi engelliyor:
- aynı kullanıcı **bir kez** kod kullanabilir (`referred_by` doluysa reddeder)
- **kendi kodunu** kullanamaz
- geçersiz kod reddedilir

Bu kontroller veritabanında; client'ta tekrarlaman gerekmez. Ama şu **hâlâ
mümkün**: bir kişi sahte hesaplar açıp kendi kodunu kullanabilir. Anonim
oturumların bedava olduğu bir uygulamada bunu tamamen engellemek mümkün değil —
ödül miktarını buna göre küçük tut, ya da ödülü yalnızca e-posta doğrulanmış
hesaplara ver:

```sql
if (select email from auth.users where id = uid) is null then
  raise exception 'EMAIL_REQUIRED';
end if;
```

## Davet linki

`deep-linking` modülünü de kurduysan:

```ts
const url = shareableUrl(`davet/${code}`);
```
ve `linking.ts` > `config.screens`'e kodu okuyup girdiye dolduran bir rota ekle.
