# modules/revenuecat

Uygulama içi satın alma. İki parça:

- `src/lib/purchases.ts` — SDK wiring (configure, offerings, purchase, restore)
- `supabase/functions/revenuecat-webhook/` — satın almayı krediye çevirir
  (**yalnızca `credits` modülü de kuruluysa deploy et**)

Sadece abonelik satıyorsan webhook'a hiç ihtiyacın yok — entitlement kontrolü
client'ta yapılır (bkz. `modules/paywall-gate`).

## OTOMATİKLEŞTİRİLEMEYEN ADIMLAR — en erken başla

**TUZAK #8: RevenueCat ürünleri "Missing Metadata" durumunda kalabilir.**
App Store Connect'te her IAP için fiyat ve isim girilip Apple onayına
gönderilmeden **gerçek satın almalar çalışmaz**. Sandbox'ta çalışıp production'da
sessizce başarısız olabilir. Bu adım yalnızca App Store Connect erişimi olan
kişi tarafından yapılabilir, otomatikleştirilemez ve onay **günler** sürebilir.
Release planında bunu ilk işlerden biri yap.

Sıra:
1. RevenueCat projesi + iOS/Android app'leri → public SDK key'leri `.env`'e
2. App Store Connect: IAP ürünleri (Consumable/Auto-Renewable), fiyat + isim, onaya gönder
3. RevenueCat: ürünleri tek bir Offering'e Package olarak ekle
4. `supabase functions deploy revenuecat-webhook --no-verify-jwt`
5. `supabase secrets set REVENUECAT_WEBHOOK_SECRET=...` + RevenueCat Webhooks
   ekranındaki "Authorization header value" ile **birebir aynı** olmalı

## Bilinmesi gerekenler

- `configurePurchases()` çağrısını **try/catch ile sar**. Native/JS sürüm
  uyuşmazlığında patlarsa oturum akışını kilitlememeli — satın alma çalışmasa da
  uygulama açılmalı.
- `ensureSession()`'dan **sonra** çağır; `appUserID` olarak Supabase user id'sini
  kullan, webhook eşleştirmesi buna dayanıyor.
- Anonim oturumdan gerçek hesaba geçişte `switchPurchasesUser()` çağır — yoksa
  satın almalar eski anonim ID'de asılı kalır.
- Abonelik satıyorsan görünür bir "Satın Almaları Geri Yükle" butonu koy
  (`restorePurchases()`); Apple Guideline 3.1.1 bunu istiyor.
- Android tarafında RevenueCat'te gerçek bir Play Store app'i yoksa SDK
  gürültülü log basar; `LogBox.ignoreLogs(["[RevenueCat]"])` ile geçici olarak
  susturabilirsin (app'i bağlayınca kaldır).
- `src/lib/creditProducts.ts` ↔ webhook içindeki `CREDIT_PRODUCTS` kopyası
  **senkron** olmalı.
