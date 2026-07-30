# modules/media-render

Sunucu tarafında paylaşılabilir kart üretir: SVG → PNG (`sharp`) → mp4
(`ffmpeg-static`). Docker imajı hazır, Railway/Render/Fly.io'da "deploy from
Dockerfile" ile doğrudan yayına alınır.

**Neden sunucuda:** `react-native-view-shot` native tarafta sadece statik PNG
yakalayabiliyor. Animasyonlu paylaşım (Instagram Stories bir GIF'i yüklerken
statik hale çeviriyor, o yüzden mp4 şart) ancak sunucuda üretilebiliyor.

## API

```
GET /render.mp4?templateId=dark&title=...&body=...&footer=...   → video/mp4
GET /render.png?templateId=dark&title=...&body=...&footer=...   → image/png
GET /health
```

`MEDIA_RENDER_TOKEN` env değişkeni set edilmişse `Authorization: Bearer <token>`
zorunlu. GET + query string kullanılıyor (POST değil) — `expo-file-system`'in
`downloadFileAsync`'i sadece GET URL alıyor.

## Lokal

```bash
cd server/media-render
npm install
npm run render:test   # test-dark.png/.mp4, test-light.png/.mp4 üretir
npm start
```

`render:test`'in çıktısını **gözle** kontrol et — font eksikse metin boş
kutucuk (tofu) çıkar, HTTP 200 döndüğü için başka türlü fark edilmez.

## TUZAK #4: Railway'de ffmpeg OOM (SIGKILL)

`libx264`, konteynerin gördüğü (yanıltıcı yüksek) CPU sayısına göre
`threads=60` gibi bir değer seçip **kare 0'da bile** OOM'dan öldürülüyor.
`render.js`'teki `-threads 2` bunu engelliyor — **kaldırma**.

Bu hata sadece HTTP durum koduna bakarak bulunamadı; Railway CLI'ye
`railway login --browserless` ile girip `railway logs` ile canlı log izlemek
gerekti. Render patlıyorsa ilk yapacağın şey platformun canlı logunu açmak.

Ayrıca `-loglevel error`: ffmpeg'in per-frame ilerleme çıktısı stderr'e akıp
Node'un `execFile` varsayılan 1MB `maxBuffer`'ını aşıyor ve süreci SIGTERM ile
öldürüyordu ("ara sıra render patlıyor" şikayetinin gerçek sebebi).

FPS 8'de sabit: yavaş animasyonlarda 12fps'ten görsel olarak ayırt edilemiyor
ama kare sayısını 1/3 azaltıyor.

## TUZAK #5: Docker konteynerinde hiç font yok

`node:20-slim` gibi imajlarda sistem fontu bulunmaz; `sharp`/`librsvg` SVG→PNG
render ederken **tüm metni boş kutucuk** olarak çizer. Dockerfile bunu iki
adımda çözüyor, ikisi de gerekli:

1. `fontconfig` + `fonts-dejavu-core` kur (Türkçe karakter güvenlik ağı)
2. `fonts/*.ttf`'i hem `./fonts`'a (ölçüm için) hem `/usr/share/fonts/...`'a
   (rasterizer için) kopyala, `fc-cache -f` çalıştır

**Word-wrap gerçek font metrikleriyle yapılmalı.** Kaba karakter-sayımı tahmini
(`fontSize * 0.54`) gerçek metriklerle uyuşmuyor ve satır kırılımları
önizlemeden farklı çıkıyor. `opentype.js` ile ölçüyoruz — ama
`font.getAdvanceWidth()` **kullanılamıyor**: tam text-shaping yaptığı için
Inter'deki bir "ccmp" lookup formatında çöküyor (`features:{liga:false}` bile
kurtarmıyor). Onun yerine harf harf `charToGlyph().advanceWidth` toplayan
`measureWidth()` var.

## Tasarımı değiştirme

Tek tasarım dosyası `src/templates.js`. Kart 210×373 viewBox'ta çizilip
1080×1920'e ölçekleniyor (Instagram Story çözünürlüğü — daha küçük tutmak
telefonda gözle görülür şekilde bulanıklaştırıyor).

Uygulamada aynı kartın statik bir React Native önizlemesi de varsa
koordinatları/renkleri **birebir aynı** tut; biri değişirse diğeri de
güncellenmeli, yoksa paylaşılan görsel önizlemeden farklı çıkar.

Font değiştirirsen `.ttf` dosyalarını `fonts/` klasörüne koy (Dockerfile
oradan alıyor). Şu an gelen fontlar Fraunces + Inter (SIL Open Font License).

## Deploy

Railway/Render'da **repo root'u değil `server/media-render` alt klasörünü** kök
olarak seç. Gerekli env: `MEDIA_RENDER_TOKEN`. Deploy sonrası çıkan URL'i
`.env`'e `EXPO_PUBLIC_MEDIA_RENDER_URL` olarak yaz **ve** `eas env:create` ile
EAS'a da kaydet (yerel `.env` build'e gitmiyor).
