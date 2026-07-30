# modules/geolocation

Konum izni, okunabilir yer adı ve "yakındakiler" sorgusu.

```ts
const coords = await requestLocation();
if (coords) {
  const label = await reverseGeocodeLabel(coords);   // "Kadıköy, İstanbul"
  const results = await nearby(coords, { radiusKm: 5 });
}
```

## PostGIS yok — Haversine yeterli

`nearby_places` düz SQL'le Haversine hesaplıyor; şehir/ülke ölçeğinde
"yakındakiler" için yeterince doğru ve ek bir extension gerektirmiyor.

Performans için önce bir **bounding box** filtresi uygulanıyor (index'ten
faydalanır), trigonometri sadece kalan satırlarda çalışıyor. Bu ön filtre
olmadan her sorgu tüm tabloyu tarar.

Gerçek geometri işlemleri gerekirse (poligon içi mi, rota mesafesi, karmaşık
uzamsal index) o zaman `create extension postgis` + `geography` kolonu +
`ST_DWithin`'e geç.

## Kendi tablonu kullan

`places` tablosu bir kolaylık. Zaten lat/lon tutan bir tablon varsa
`nearby_places`'i kendi kolonlarınla yaz ve `places`'ı sil.

## İzin: sadece ön plan

`requestForegroundPermissionsAsync` kullanılıyor. **Arka plan konumu istemeyin**
— Apple ek gerekçe ister ve review'ı belirgin şekilde zorlaştırır. Gerçekten
gerekiyorsa `expo-location`'ın background location API'sine ve
`UIBackgroundModes`'a bakman gerekir.

`app.json`'daki `locationWhenInUsePermission` metni iOS izin dialogunda **aynen**
görünür; genel bir ifade ("konumunuza ihtiyacımız var") reddedilme sebebi
olabilir, somut yaz.

## Gizlilik

- Konumu **asla URL query string'ine koymayın** — log'lara ve üçüncü taraflara
  sızar. `nearby()` RPC gövdesiyle gönderiyor.
- Kullanıcı konumunu veritabanında saklıyorsan gizlilik politikasına
  (`docs/privacy.html`) ve App Store Connect > App Privacy beyanına ekle.
- `reverseGeocodeLabel` yalnızca görüntü için — başarısız olabilir, hesaplamalar
  buna bağımlı olmasın.
