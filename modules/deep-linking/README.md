# modules/deep-linking

Paylaşılan bir linkten doğru ekrana düşme. İki katman:

- **Custom scheme** (`__APP_SLUG__://hesap`) — kurulum gerektirmez, hemen çalışır
- **Universal links / App links** (`https://<domain>/hesap`) — tarayıcıya
  düşmeden doğrudan uygulamayı açar, ama `.well-known` dosyalarının yayında
  olmasını gerektirir

## ZORUNLU tek satır

`App.tsx`'teki `<NavigationContainer>`'a `linking` prop'unu ekle:

```tsx
import { linking } from "./src/lib/linking";
...
<NavigationContainer ref={navigationRef} linking={linking}>
```

Bu satır olmadan hiçbir link ekrana düşmez. (create.mjs App.tsx'e ekran
enjekte ediyor ama bu prop'u eklemiyor — elle yap.)

Uygulama **kapalıyken** açılan link için ayrı kod yazmak gerekmez; React
Navigation initial URL'i de aynı `config` ile çözer.

## Rota eşlemesi

`src/lib/linking.ts` > `config.screens`. Parametreli rota:

```ts
Feed: "akis/:postId",
```
Parametre tipini `RootStackParamList`'te de tanımla, yoksa TypeScript şikayet
eder.

## iOS: apple-app-site-association

`docs/.well-known/apple-app-site-association` içindeki `TEAMID`'yi gerçek Apple
Team ID'nle değiştir (`eas.json` > submit > appleTeamId).

Dosya şu şartları **birlikte** karşılamalı, yoksa iOS sessizce yok sayar:
- `https://<domain>/.well-known/apple-app-site-association` adresinde
- `Content-Type: application/json`
- **yönlendirme (301/302) olmadan** servis edilmeli
- uzantısız (`.json` ekleme)

GitHub Pages bu dosyayı doğru content-type ile servis eder ama
`docs/.well-known/` klasörünün yayınlandığını kontrol et (Jekyll bazı
kurulumlarda alt çizgi/nokta ile başlayan klasörleri atlar — gerekirse
`docs/.nojekyll` boş dosyası ekle).

Doğrulama: `curl -I https://<domain>/.well-known/apple-app-site-association`

## Android: assetlinks.json

`sha256_cert_fingerprints` alanına `eas credentials` çıktısındaki SHA-256
parmak izini yaz. `autoVerify: true` (app.json'da hazır) olmadan Android linki
tarayıcıda açar.

Doğrulama: https://developers.google.com/digital-asset-links/tools/generator

## Test

```bash
npx uri-scheme open "__APP_SLUG__://hesap" --ios
```

Universal link'i **Safari'nin adres çubuğuna yazarak test etmeyin** — çalışmaz.
Notes/Mesajlar'a linki yazıp dokunmak gerekiyor.
