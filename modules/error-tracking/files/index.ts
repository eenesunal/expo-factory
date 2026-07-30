import * as Sentry from "@sentry/react-native";
import { registerRootComponent } from "expo";
import App from "./App";

// `core/app-shell`'in index.ts'inin ÜZERİNE yazılmış hali. Sentry.init'in
// App.tsx yerine burada olmasının sebebi: render'dan önce çalışması gerekiyor,
// yoksa açılışta atılan hataları (tuzak #9'un yuttuğu hatalar dahil) yakalamaz.

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

if (DSN) {
  Sentry.init({
    dsn: DSN,
    // Kişisel veri (IP, cihaz adı, çerez) gönderme — hata triyajı için
    // gerekmiyor ve App Privacy beyanını büyütüyor.
    sendDefaultPii: false,
    // Performans izleme kapalı: ücretsiz kotayı hızla yakıyor ve crash takibi
    // için gerekmiyor. İhtiyaç olursa 0.1 gibi küçük bir oranla aç.
    tracesSampleRate: 0,
  });
}

// Sentry.wrap: JS render hatalarını (aksi halde beyaz ekran) ve navigation
// context'ini yakalar. DSN yoksa hiç sarmıyoruz — davranış modülsüz haliyle
// birebir aynı kalsın.
registerRootComponent(DSN ? Sentry.wrap(App) : App);
