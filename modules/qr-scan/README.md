# modules/qr-scan

`expo-camera`'nın barkod okuma API'siyle QR/barkod tarama ekranı.

## İki şey unutulur

**1. Okuma kilidi.** `onBarcodeScanned` aynı kod için saniyede onlarca kez
tetiklenir. Kilit koymazsan `navigate` ya da ağ isteği defalarca çalışır.
`ScanScreen` bir `useRef` bayrağıyla kilitliyor — kendi ekranını yazarken bunu
atlamayın.

**2. Okunan veri dışarıdan gelen bir girdidir.** Doğrulamadan kullanma:
URL ise şemasını (`https:` mi, `javascript:` değil mi) kontrol et, kendi ID
formatına uyuyor mu bak. Doğrudan `Linking.openURL(data)` çağırmak kötü bir
fikir.

## Test

Kamera Expo Go'da kısıtlı çalışır — development build gerekiyor:

```bash
eas build --platform ios --profile development
```

## Kod tipleri

`BARCODE_TYPES` dar tutuldu (`qr`, `ean13`, `code128`). Listeyi geniş tutmak
yanlış okuma olasılığını artırır — sadece gerçekten okuyacağın tipleri ekle.
Tam liste: Expo `expo-camera` dokümantasyonunda `BarcodeType`.

## İzin metni

`app.json` > `plugins` > `expo-camera` > `cameraPermission` metni iOS izin
dialogunda aynen görünür. Apple genel ifade değil somut gerekçe istiyor.
