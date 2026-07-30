# modules/auth-providers

Sign in with Apple + Google. `core/auth`'un e-posta OTP akışının **üstüne**
eklenir, onu değiştirmez — anonim-önce mantığı aynen korunur.

## APPLE KURALI: başka üçüncü taraf login varsa Apple ZORUNLU

Google (ya da Facebook, X...) ile giriş sunuyorsan App Store, Sign in with
Apple'ı da sunmanı **şart koşuyor**. Sadece e-posta OTP kullanıyorsan zorunlu
değil — o yüzden bu modül opsiyonel.

## Anonim oturumdaki veri OTOMATİK TAŞINMAZ

`signInWithIdToken` **yeni** bir oturum açar; mevcut anonim kullanıcının verisi
gitmez. İki seçenek:

- **Taşınması gerekmiyorsa:** olduğu gibi bırak (en basit, çoğu app için yeterli).
- **Taşınması gerekiyorsa:** anonim oturum açıkken
  `supabase.auth.linkIdentity({ provider: "apple" })` kullan — `user.id`
  korunur. Supabase Dashboard > Auth > Providers'da "Manual linking" açık olmalı.

(`core/auth`'un e-posta akışı `updateUser` ile ikinci yolu izliyor, o yüzden
orada veri kaybı yok.)

## Kurulum

**Apple**
1. Apple Developer > Identifiers > app ID'n > "Sign in with Apple" capability'sini aç
2. Supabase > Auth > Providers > Apple: etkinleştir, "Client IDs" = bundle
   identifier'ın (native akışta client secret gerekmez)
3. `app.json`'a `ios.usesAppleSignIn: true` ve `expo-apple-authentication`
   plugin'i create.mjs tarafından eklendi

**Google**
1. Google Cloud Console > Credentials: **üç** OAuth client oluştur — iOS,
   Android, Web. Android'de SHA-1 parmak izi gerekiyor (`eas credentials`).
2. Üçünü `.env`'e yaz (`EXPO_PUBLIC_GOOGLE_*_CLIENT_ID`) ve `eas env:create`
   ile EAS'a da kaydet.
3. Supabase > Auth > Providers > Google: etkinleştir, "Authorized Client IDs"
   alanına üç ID'yi **virgülle ayırarak** ekle. Bu adım atlanırsa Supabase
   token'ı reddeder ("Unacceptable audience").

## Kullanım

```tsx
const { promptAsync, ready } = useGoogleSignIn();

<PressableScale disabled={!ready} onPress={() => promptAsync()}>...</PressableScale>
<PressableScale onPress={signInWithApple}>...</PressableScale>
```

Apple butonunu `AppleAuthentication.AppleAuthenticationButton` ile çizmek en
güvenlisi — Apple, butonun görsel kurallarına (renk, köşe, metin) uyulmasını
istiyor.

`isAppleSignInAvailable()` Android'de ve eski iOS'ta `false` döner; butonu
koşullu göster.
