# core/notifications

Yerel (cihaz üstünde zamanlanan) bildirimler. Sunucudan gönderilen push için
`modules/push-remote`'a bak — bu modül onu kapsamaz.

## Kullanım

```ts
// src/lib/dailyTip.ts — MODÜL SCOPE'unda çağırılmalı
import { createDailyNotifications } from "./localNotifications";

export const dailyTip = createDailyNotifications({
  key: "daily-tip",
  times: [[10, 0], [21, 0]],
  contentFor: async () => {
    const tip = await fetchRandomTip();
    return {
      title: "Günün ipucu",
      body: tip.text,
      data: { screen: "TipDetail", params: { id: tip.id } },
    };
  },
});
```

Ayarlar ekranında: `await dailyTip.setEnabled(true)`.
Mevcut durum: `await dailyTip.isEnabled()`.

`App.tsx` içinde `useNotificationRouting()` zaten çağrılı — bildirime
dokununca `data.screen` ekranına gider.

## Neden DAILY trigger kullanılmıyor

`expo-notifications`'ın `DAILY` trigger'ı her gün **aynı** içeriği tekrarlar.
Her gün farklı içerik (taze bir ipucu, güncel bir veri) göstermek istiyorsan tek
yol: sadece bugünün henüz geçmemiş saatlerini zamanla, `expo-background-task`
ile günde bir kez tazele. `createDailyNotifications` bunu yapıyor.

Sabit içerikli, gerçekten her gün aynı olan bir hatırlatma için doğrudan
`Notifications.scheduleNotificationAsync` + `DAILY` trigger daha basit —
background task'a hiç gerek yok.

## Bilinmesi gerekenler

- `TaskManager.defineTask` **modül scope'unda** çalışmalı. `createDailyNotifications`
  içeriden çağırdığı için factory'yi bir dosyanın en üst seviyesinde çağır.
- Background task'ın ne zaman çalışacağına iOS karar verir; `minimumInterval`
  bir garanti değil, alt sınır. Kullanıcı uygulamayı hiç açmazsa günler
  atlanabilir — bu yüzden uygulama her açıldığında da `scheduleToday()`
  çağırmak iyi bir fikir.
- Zamanlanmış bildirimler Expo Go'da güvenilmez; development build ya da
  gerçek build ile test et.
