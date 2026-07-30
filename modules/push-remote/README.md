# modules/push-remote

Sunucudan kullanıcıya push. `core/notifications` **yalnızca yerel/zamanlanmış**
bildirim yapar — uzaktan gönderim bu modül.

## Parçalar

- `push_tokens` tablosu (kullanıcı başına çok cihaz)
- `src/lib/pushToken.ts` — `registerPushToken()` / `unregisterPushToken()`
- `supabase/functions/send-push/` — Expo push API'sine gönderen edge function

## GÜVENLİK: `send-push` uygulamadan çağrılmaz

`PUSH_ADMIN_SECRET` ile korunuyor ve bu secret **uygulamaya gömülmemeli** —
gömülürse herkes tüm kullanıcılarına bildirim gönderebilir. Cron job, admin
script'i ya da başka bir backend'den çağır.

```bash
supabase secrets set PUSH_ADMIN_SECRET=$(openssl rand -hex 32)
supabase functions deploy send-push --no-verify-jwt
```

```bash
curl -X POST "$SUPABASE_URL/functions/v1/send-push" \
  -H "Authorization: Bearer $PUSH_ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"userIds":["<uuid>"],"title":"Merhaba","body":"Yeni bir şey var","data":{"screen":"Feed"}}'
```

`data.screen` verirsen `core/notifications`'ın `useNotificationRouting()`'i
bildirime dokununca o ekrana gider.

## Kurulum

- iOS: `eas credentials` ile APNs key (EAS otomatik oluşturabilir)
- Android: `eas credentials` ile FCM V1 service account JSON'u
- `eas init` yapılmış olmalı — `getExpoPushTokenAsync` `projectId` olmadan
  anlaşılmaz bir hatayla patlar
- Push **simülatörde çalışmaz**; development build ya da gerçek build gerekir

## Token yaşam döngüsü

- Oturum kurulduktan sonra her açılışta `registerPushToken()` çağır — token
  cihaz/kurulum başına değişir, upsert ediyoruz.
- Çıkışta `unregisterPushToken()` çağır, yoksa aynı cihazdaki bir sonraki
  kullanıcı önceki hesabın bildirimlerini alır.
- `send-push`, `DeviceNotRegistered` dönen ölü token'ları otomatik siler.
  Temizlenmezse her gönderimde hata üretmeye devam ederler.
