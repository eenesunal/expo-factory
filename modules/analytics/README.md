# modules/analytics

PostHog ile olay takibi. Ücretsiz tier var, self-host edilebilir, RN SDK'sı
resmi.

```ts
track("soru_soruldu", { kaynak: "anasayfa" });
screen("Feed");
identify(user.id);         // anonim -> gerçek hesap geçişinde
```

## Neden ince bir sarmalayıcı

Provider-agnostik bir "analytics arayüzü" + adapter katmanı **yok**. Tek
sağlayıcı kullanıyorsun; ikincisi gerçekten gelirse o zaman soyutlarsın.
Sarmalayıcının tek işi: `EXPO_PUBLIC_POSTHOG_KEY` yoksa çağrılar sessizce
hiçbir şey yapsın — analytics'i eklemek/çıkarmak kod değişikliği gerektirmesin.

## App Store beyanı ZORUNLU

App Store Connect > App Privacy bölümünde analytics kullanımını beyan et
("Product Interaction", "Usage Data"). Beyan etmemek doğrudan reddedilme
sebebi. Gizlilik politikasına (`docs/privacy.html`) da PostHog'u ekle.

## Kişisel veri

Event property'lerine e-posta, ad, tam konum **koymayın** — bunlar PostHog'da
saklanır ve beyan yükümlülüğünü büyütür. Kullanıcı ilişkilendirmesi için
`identify(userId)` yeterli (Supabase user id'si, e-posta değil).

## Host

`https://eu.i.posthog.com` (AB, KVKK/GDPR açısından tercih edilir) ya da
`https://us.i.posthog.com`. Varsayılan AB.
