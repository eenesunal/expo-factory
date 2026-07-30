# modules/rating-prompt

```ts
// Kullanıcı BAŞARILI bir şey tamamladıktan hemen sonra:
await recordSuccessfulAction();
```

5. başarılı aksiyondan sonra sistem değerlendirme dialogunu bir kez ister,
sonra bir daha denemez.

## Bilinmesi gerekenler

- Dialog **yalnızca App Store/TestFlight'tan kurulmuş** uygulamalarda görünür.
  Development build'de hiçbir şey olmaz — bu normal, bozuk değil.
- iOS dialogu gösterip göstermeyeceğine **kendisi** karar veriyor (yılda en
  fazla 3 kez) ve sonucu bize söylemiyor. Bu yüzden bir kez denedikten sonra
  tekrar denemiyoruz.
- **Hata sonrası asla çağırma.** Bir hatanın hemen ardından değerlendirme
  istemek 1 yıldız getirir.
- Ayarlar ekranındaki "Bizi değerlendir" butonu için `openStoreListing()`
  kullan — mağaza sayfasını açar, sistem dialogunun kotasını harcamaz.

`openStoreListing()` `expo-linking` kullanıyor (Expo'yla birlikte gelir, ayrı
kurulum gerekmez).
