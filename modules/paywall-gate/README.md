# modules/paywall-gate

```tsx
<Paywalled entitlement="pro" onUpgrade={() => navigation.navigate("Paywall")}>
  <ProOnlyFeature />
</Paywalled>
```

`revenuecat` modülüne bağımlı (create.mjs onu otomatik ekler).

## ABONELİK ≠ KREDİ

Bu modül RevenueCat **entitlement**'ına bakar — süregelen bir abonelik hakkı.
Tüketilebilir kredi modeli istiyorsan `modules/credits` kullan; ikisi birlikte
de çalışır (abonelik = sınırsız, kredi = paket satın alma).

RevenueCat Dashboard > Entitlements'ta bir entitlement oluştur (örn. `pro`) ve
abonelik ürünlerini ona bağla; `entitlement` prop'u bu adı kullanır.

## Satın alma tamamlanınca ekran kendini günceller

`useEntitlement`, RevenueCat'in `customerInfo` listener'ına abone — satın alma
bitince gate kendiliğinden açılır, elle yenileme gerekmez.

## Paywall ekranını sen yazıyorsun

Kasıtlı: paywall tasarımı uygulamaya çok özel. `revenuecat` modülündeki
`getOffering()` + `purchasePackage()` ile kendi ekranını yaz.

- Fiyatı **RevenueCat'in verdiği `priceString`** ile göster. Elle yazılan fiyat
  para birimi/bölge değişince yanlış olur ve Apple bunu reddedebilir.
- Abonelikte görünür bir **"Satın Almaları Geri Yükle"** butonu zorunlu
  (Guideline 3.1.1) — `restorePurchases()` hazır.
- Abonelik süresi, yenileme davranışı ve iptal yolu paywall ekranında yazılı
  olmalı (Guideline 3.1.2), yoksa reddedilir.
