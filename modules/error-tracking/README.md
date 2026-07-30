# modules/error-tracking

Sentry ile crash + exception takibi. Native crash'leri, JS exception'ları ve
render hatalarını yakalar; source map yüklendiğinde stack trace'i okunabilir
hale getirir.

```ts
reportError("Akış okunamadı", error);
reportError("Yükleme hatası", error, { boyut: bytes });
setErrorUser(session.user.id);   // core/auth bunu kendisi çağırıyor
```

## Nasıl bağlanıyor: dosya ezme

`core/app-shell` her projeye no-op bir `src/lib/reportError.ts` koyuyor —
sadece `console.error`'a yazar, yani modülsüz davranış bugünküyle birebir aynı.
Projedeki 21 hata yakalama noktası **her zaman** `reportError()` çağırıyor.

Bu modül seçilirse aynı yola Sentry'li sürümünü ve `index.ts`'in Sentry'li
halini koyuyor. `create.mjs` core birimlerini modüllerden önce kopyaladığı ve
`cp`'yi `force: true` ile çağırdığı için modülün dosyaları core'un üzerine
yazılıyor. Çağıran taraf hiç değişmiyor, `create.mjs`'e de dokunulmuyor.

Sonuç: hata takibini eklemek/çıkarmak tek bir modül seçimi. `deep-linking`'de
olduğu gibi "şu satırı elle ekle" adımı yok.

## Neden `console.error` yetmiyor

Production build'de `console.error` hiçbir yere gitmez. En kritik iki nokta
`App.tsx`'te: tuzak #9'un `.catch()` + timeout'u uygulamayı sonsuza dek
splash'ta donmaktan kurtarıyor ama **hatayı da yok ediyor**. Kullanıcı tarafında
belirti "uygulama açılıyor ama boş" oluyor — tuzak #1'in (EAS'a yüklenmemiş env
değişkenleri) ürettiği belirtinin aynısı. Bu modül olmadan o sinyal sana hiç
ulaşmıyor.

## Sentry.init neden index.ts'te

Render'dan önce çalışmak zorunda. `App.tsx`'in içine koyarsan açılışta atılan
hatayı kaçırırsın — ki en pahalı hatalar tam olarak onlar.

## Gruplama: `fingerprint: [message]`

`reportError`'ın ilk argümanı sabit bir başlık ve issue'lar ona göre gruplanıyor.
Bu olmadan her farklı ağ hatası metni ayrı bir issue açar, liste birkaç günde
okunmaz hale gelir. Değişken veriyi (id, sayı, sorgu) `context`'e koy, başlığa
koyma.

## Beklenen hataları rapor ETME

Kullanıcının yanlış OTP kodu girmesi hata değil, akışın parçası. `core/auth`'da
`translateAuthError` bu yüzden sadece **hiçbir desene uymayan** mesajı rapor
ediyor; tanıdığı hataları yalnızca konsola yazıyor. Yeni bir yakalama noktası
eklerken aynı ayrımı yap — yoksa ücretsiz kota biter ve gerçek crash'ler
gürültüde kaybolur.

## Source map olmadan işe yaramaz

`SENTRY_AUTH_TOKEN` olmadan release build'de stack trace şöyle görünür:

```
index.android.bundle:1:284919
```

Yani hiçbir şey. Token'ı **EAS secret** olarak kaydet (`--type secret`),
`EXPO_PUBLIC_` olarak DEĞİL — org'una yazma yetkisi veren bir token'ı
uygulama paketine gömmek istemezsin.

Doğrulamayı mutlaka gerçek bir build'de yap: geçici bir
`throw new Error("sentry testi")` ile tetikle ve Sentry'de dosya+satır gördüğünü
teyit et. `expo start`'ta source map zaten yerel, sorun orada görünmez.

## Alert kurmadan bildirim gelmez

Sentry varsayılan haliyle sana haber vermez, sadece dashboard'a yazar. En az iki
kural kur (Sentry > Alerts): yeni issue açıldığında, ve bir issue 1 saat içinde
N'den fazla kullanıcıyı etkilediğinde. İzlenecek asıl metrik **crash-free
session rate** (Sentry > Releases) — yeni sürümden sonra düşüyorsa dağıtımı
durdur.

## App Store beyanı

App Store Connect > App Privacy: "Diagnostics" > "Crash Data" beyan et.
`docs/privacy.html`'e Sentry'yi ekle.

## Alternatifler

- `modules/analytics` (PostHog) zaten seçiliyse `captureException`'ı var: yeni
  sağlayıcı sıfır. Tavan: native crash yakalamıyor, source map sembolikasyonu
  ve alert kuralları zayıf.
- App Store Connect > Crashes + Play Console Vitals: bedava, paket yok, ama
  sadece **native** crash görürsün. React Native'de hataların çoğu JS tarafında
  ve orada hiç görünmez.
