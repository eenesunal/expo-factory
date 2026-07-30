# core/marketing-site

`docs/` altında statik tanıtım sitesi + gizlilik/şartlar sayfaları. GitHub Pages
ile ücretsiz yayınlanır, ayrı bir hosting gerekmez.

**Neden core:** App Store Connect **gizlilik politikası URL'sini zorunlu bir alan
olarak** istiyor. Uygulaman ne kadar basit olsa da bir yerde yayınlanmış bir
`privacy.html`'e ihtiyacın var — o yüzden bu seçilebilir bir modül değil.

## GitHub Pages kurulumu

1. Repo > **Settings > Pages**: Source = "Deploy from a branch",
   Branch = `main`, Folder = **`/docs`**.
2. Birkaç dakika sonra `https://<kullanıcı>.github.io/<repo>/` yayında.

## Özel domain (opsiyonel)

- `docs/CNAME` içinde domainin yazılı olmalı (create.mjs senin verdiğin domaini
  yazdı). **Domain kullanmayacaksan `docs/CNAME`'i sil**, yoksa Pages yanlış
  domaine yönlenmeye çalışır ve site 404 verir.
- Domain sağlayıcında:
  - apex domain (`ornek.com`) için A kayıtları:
    `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
  - subdomain (`www.ornek.com`) için CNAME: `<kullanıcı>.github.io`
- DNS yayıldıktan sonra Pages ayarlarında **Enforce HTTPS**'i işaretle
  (sertifika üretimi 15 dk–24 saat sürebilir).

## Elle düzeltilecekler

- `index.html`: başlık, açıklama, özellik kartları, App Store linki
- `privacy.html` / `terms.html`: içindeki `[TARİH]` ve `[...]` yer tutucuları.
  Gizlilik metni **App Store Connect'teki "App Privacy" beyanıyla tutarlı
  olmalı** — uyuşmazlık review'da reddedilme sebebi.
- `docs/assets/`: `og-image.png` (1200×630), `favicon.png`, `apple-touch-icon.png`.
  Yoksa paylaşım kartları boş çıkar (HTML bunlara referans veriyor).
