# expo-factory

Expo + Supabase mobil uygulama **seri üretim kütüphanesi**. Fork'layıp
gerekmeyeni sildiğin bir template değil: birkaç soruya cevap veriyorsun, sadece
seçtiğin modüller hedef projeye kopyalanıyor. Seçmediklerin projede hiç yer
kaplamıyor — ne dosya, ne bağımlılık, ne `schema.sql` satırı, ne env değişkeni.

Her şey [gethafizai.com](https://gethafizai.com) (Hafız AI) üretiminden
çıkarıldı: App Store'da yayında olan, Expo SDK 57 + Supabase + RevenueCat +
Railway ile kurulmuş gerçek bir uygulama. Aşağıdaki **10 tuzağın** her biri o
süreçte canlı ortamda öğrenildi.

## Kullanım

```bash
git clone https://github.com/eenesunal/expo-factory
cd expo-factory
npm install
node create.mjs
```

Sorulanlar: uygulama adı, slug, bundle identifier, tanıtım sitesi domaini, hedef
klasör, modüller. Sonunda hedef klasöre bir `SETUP.md` yazılır ve ekrana
basılır — elle yapılması gereken her adım orada.

```bash
cd ../yeni-uygulaman
npm install
npx expo start
```

## Mimari

```
core/          # her projede var, seçilebilir değil
  app-shell/       navigation, tema, PressableScale, AnimatedModal, açılış akışı,
                   reportError() (hata takibi için tek geçiş noktası)
  auth/            Supabase anonim oturum + e-posta OTP + hesap silme
  eas-setup/       eas.json + .env'i EAS'a yükleyen script
  notifications/   yerel/zamanlanmış bildirim + bildirimden ekrana yönlendirme
  marketing-site/  docs/ + GitHub Pages + gizlilik/şartlar sayfaları

modules/       # seçtiğin kadarı
  analytics        olay takibi (PostHog), ince track() sarmalayıcı
  auth-providers   Sign in with Apple + Google
  credits          tüketilebilir kredi sistemi (atomik harcama/ekleme)
  deep-linking     paylaşılan linkten doğru ekrana düşme
  error-tracking   Sentry ile crash/exception takibi + alert kuralları
  feed             gönderi + yorum akışı            → likes
  file-upload      Supabase Storage'a görsel yükleme
  geolocation      konum izni + "yakındakiler" (Haversine, PostGIS'siz)
  i18n             çoklu dil (TR + EN): tipli sözlük, çoğul, cihaz dili
  leaderboard      herhangi bir skora göre sıralama
  likes            entity_id bazlı beğeni + en çok beğenilenler
  media-render     sunucuda paylaşılabilir görsel/video (Docker + ffmpeg)
  moderation       raporlama + engelleme (UGC için Apple 1.2)
  paywall-gate     "bu özellik Pro'da" gate bileşeni  → revenuecat
  push-remote      sunucudan uzaktan push
  qr-scan          kamera ile QR/barkod okuma
  rag              hibrit arama + kaynağa dayalı LLM cevabı
  rating-prompt    App Store değerlendirme isteme
  realtime-chat    canlı sohbet + presence
  referral         davet kodu + ödül                 → credits
  revenuecat       uygulama içi satın alma + webhook
  search           LLM'siz trigram arama
```

`→` bağımlılık: onu seçmesen de otomatik eklenir ve ekranda bildirilir.

Her modül klasöründe `manifest.json`, kendi `README.md`'si ve (varsa)
`schema.sql` parçası bulunur. Modülün README'si o modülün **otomatikleştirilemeyen**
adımlarını (App Store Connect, Railway, Google Cloud...) açıkça yazar.

### manifest.json

```json
{
  "name": "qr-scan",
  "description": "Kamera ile QR / barkod okuma ekranı",
  "dependsOn": [],
  "envVars": [],
  "packageDependencies": ["expo-camera@~57.0.5"],
  "filesToCopy": ["src"],
  "schemaFragment": "schema.sql",
  "appJson": { "plugins": [["expo-camera", { "cameraPermission": "..." }]] },
  "navigationScreens": [
    { "name": "Scan", "component": "ScanScreen", "importPath": "./src/screens/ScanScreen" }
  ],
  "setupSteps": ["..."]
}
```

`create.mjs` bunları birleştirir: dosyaları kopyalar, `package.json`
bağımlılıklarını ve `app.json` plugin/izin girdilerini birleştirir, tek bir
`supabase/schema.sql` üretir, `.env.example`'ı toplar, `navigationScreens`'i
`App.tsx` + `RootStackParamList`'e enjekte eder, `SETUP.md`'yi yazar.

### Yeni modül eklemek

`modules/<isim>/manifest.json` + `files/` (hedefe kopyalanacak ağaç) +
`README.md` + isteğe bağlı `schema.sql`. `create.mjs`'e dokunmak gerekmez.

```bash
npm test    # bağımlılık çözümlemesi + uçtan uca üretim testleri
```

---

## 10 tuzak

Hepsi canlı ortamda öğrenildi. İlgili modülün README'sinde ayrıca tekrar edilir.

### 1. EAS Build yerel `.env`'i GÖRMEZ

`.env` gitignore'da olduğu için cloud build'e hiç yüklenmiyor. İki adım de
gerekli: her `EXPO_PUBLIC_*` değişkenini `eas env:create` ile EAS'a kaydet **ve**
`eas.json`'daki build profiline `"environment": "production"` ekle.

Atlanırsa production build'de **tüm** env değişkenleri `undefined` olur:
uygulama açılır, hiçbir şey yüklenmez, backend'e hiç bağlanmaz. `expo start`'ta
çalıştığı için ancak gerçek bir build'de fark edilir. Hafız'da release'e günler
kalmışken yakalandı — neredeyse boş bir uygulama yayınlanıyordu.
→ `core/eas-setup` (bu yüzden opsiyonel değil), `scripts/setup-eas-env.mjs`

### 2. iOS'ta aynı anda tek native `<Modal>`

İki Modal üst üste mount'lu kalırsa (biri kapanırken diğeri açılmaya çalışırsa)
ikincisi **sessizce** açılmıyor. "Bazen açılıyor bazen açılmıyor" tarzı
bug'ların kök nedeni hep buydu.

Çözüm: modal-ağırlıklı navigasyon akışlarını gerçek stack screen'lere çevir;
gerçekten modal kalması gerekenler için `AnimatedModal`'ın `onClosed`
callback'ini kullan — sıradaki modal'ı sabit bir `setTimeout` tahminiyle değil,
kapanışın gerçekten bittiği sinyalle aç. İç içe gerekiyorsa `nested` prop'u
native Modal açmaz.
→ `core/app-shell`

### 3. `PressableScale` — outer/inner style split'i YAPMA

Dıştaki `Pressable`'a "sizing" stilini, içteki `Animated.View`'e `flex:1` verme
deseni Yoga'da layout patlamalarına yol açıyor (bazı butonlar tüm ekranı
kaplıyor). `onLayout` ile ölçüp içteki view'ı boyutlandırmak da sonsuz render
loop'una yol açtı.

Stabil çözüm: tek bir `Animated.createAnimatedComponent(Pressable)`'a
çağıranın **tüm** stilini direkt uygula, üstüne sadece
`{transform:[{scale}], opacity}` ekle. `transform` zaten view'in kendi layout
kutusunu etkilemiyor. Split yok, heuristic yok, ölçüm yok.
→ `core/app-shell`

### 4. Railway'de ffmpeg OOM (SIGKILL)

`libx264` konteynerin gördüğü (yanıltıcı yüksek) CPU sayısına göre
`threads=60` gibi bir değer seçip **kare 0'da bile** OOM'dan öldürülüyor.
`-threads` değerini elle küçük bir sayıya (2) sabitle.

Bu hatayı görmek için `railway login --browserless` + `railway logs` ile canlı
log izlemek gerekti — sadece HTTP response koduna bakarak bulunamadı.

Aynı dosyada ikinci bir tuzak: ffmpeg'in per-frame ilerleme çıktısı stderr'e
akıp Node'un `execFile` varsayılan 1MB `maxBuffer`'ını aşıyor ve süreci SIGTERM
ile öldürüyor. `-loglevel error` şart.
→ `modules/media-render`

### 5. Docker container'da (`node:20-slim`) hiç font yok

`sharp`/`librsvg` ile SVG→PNG render ederken sistemde font olmadan **tüm metin**
boş kutucuk (tofu) çiziliyor — render "başarılı" döner, çıktı okunamaz.
`fontconfig` + gerçek font dosyalarını image'a `COPY`'leyip `fc-cache -f`
çalıştırmak gerekiyor.

Ayrıca kaba karakter-sayımı tabanlı word-wrap tahmini (`fontSize * 0.54`) gerçek
font metrikleriyle uyuşmuyor. `opentype.js` ile ölç — ama
`font.getAdvanceWidth()` **kullanılamıyor**: tam text-shaping yaptığı için bazı
fontların GSUB/"ccmp" tablolarında opentype.js'in desteklemediği bir lookup
formatında çöküyor (`features:{liga:false}` bile kurtarmıyor). Harf harf
`charToGlyph().advanceWidth` toplayan kendi ölçüm fonksiyonunu yaz.
→ `modules/media-render`

### 6. LLM'in serbest metin alanlarına GÜVENME

Bir LLM'e "referans" gibi insan-formatlı bir alan yazdırırsan bazen halüsinasyon
yapıp var olmayan bir isim uyduruyor. Çözüm: LLM'den **yapısal** veri (ID)
iste — zaten context'inde geçen etiketten kopyalasın — insan-okunur metni sen
deterministik bir lookup'la üret. Dönen ID'leri ayrıca kendi korpusunla
kesiştir; uydurulmuş bir ID sessizce düşsün.
→ `modules/rag`

### 7. Cache'lenen LLM cevaplarının şekli zamanla değişir

Response şemasına yeni bir alan eklersen eskiden cache'lenmiş satırlar o alanı
içermez ve client'ta "undefined" kırılmalarına yol açar. Cache'den okurken
satırın **beklenen şekilde** olduğunu doğrula, uymuyorsa cache'i atlayıp
yeniden üret.
→ `modules/rag` (`isCachedAnswerValid`)

### 8. RevenueCat ürünleri "Missing Metadata" durumunda kalabilir

App Store Connect'te her IAP için fiyat ve isim girilip Apple onayına
gönderilmeden **gerçek satın almalar çalışmaz**. Bu adım yalnızca App Store
Connect erişimi olan kişi tarafından yapılabilir, otomatikleştirilemez ve onay
**günler** sürebilir. Release planında en erken başlanması gereken işlerden biri.
→ `modules/revenuecat`

### 9. Kritik açılış promise'lerine HER ZAMAN `.catch()` + timeout

`ensureSession()` gibi bir çağrı ağ hatası alır ya da askıda kalırsa, `.catch()`
yoksa uygulama **sonsuza dek** splash ekranında kalır. `App.tsx` bunu 8 saniyelik
bir timeout + `.catch()` ile sarıyor. Aynı deseni açılışta beklediğin başka her
şey (font yükleme, remote config) için tekrarla.

Ama dikkat: o `.catch()` uygulamayı kurtarırken hatayı da yutuyor ve production
build'de `console.error` hiçbir yere gitmiyor. Kullanıcıda belirti "açılıyor ama
boş" oluyor — tuzak #1'in ürettiği belirtinin aynısı. Bu yüzden yakalanan her
hata `reportError()`'dan geçiyor; `modules/error-tracking` seçilirse aynı çağrılar
Sentry'ye de gidiyor.
→ `core/auth`, `core/app-shell`, `modules/error-tracking`

### 10. `app.json` > `name`, Xcode target adıyla eşleşmeli

Uyuşmazsa EAS build `Could not find target 'X' in project.pbxproj` ile patlıyor.
Kullanıcıya gösterilen adı `name` ile değiştirmeye çalışma —
`ios.infoPlist.CFBundleDisplayName` kullan.
→ `core/eas-setup`

---

## Bilinen sınırlar

- Üretilen proje **derlenerek** doğrulanmadı (her modül için `npm install` +
  `tsc` çalıştırmak gerekiyor). Paket sürümleri Expo SDK 57'ye göre sabitlendi;
  başka bir SDK'ya geçerken `npx expo install --fix` çalıştır.
- `modules/media-render`'ın Docker imajı bu repoda build edilmedi; kaynağı
  üretimde çalışan koddan alındı. Deploy etmeden önce
  `cd server/media-render && npm install && npm run render:test` çalıştırıp
  çıktıyı **gözle** kontrol et (font eksikse metin boş kutucuk çıkar).
- `deep-linking` modülü `App.tsx`'e `linking` prop'unu otomatik eklemiyor —
  o tek satırı elle ekle (modül README'sinde yazılı).
- Tüm kullanıcıya dönük metinler ve yorumlar Türkçe. Çoklu dil için `modules/i18n`; core ekranlarının metinleri henüz `t()`'ye taşınmadı.

## Lisans

MIT. `modules/media-render/files/server/media-render/fonts/` içindeki Fraunces
ve Inter fontları SIL Open Font License altındadır.
