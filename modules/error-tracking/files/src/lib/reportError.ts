import * as Sentry from "@sentry/react-native";

// Bu dosya `core/app-shell`'in no-op sürümünün ÜZERİNE yazılır (core dosyaları
// modüllerden önce kopyalanıyor). Çağıran taraf hiç değişmiyor — projedeki tüm
// `reportError(...)` çağrıları bu andan itibaren Sentry'ye de gidiyor.
//
// Sentry.init burada DEĞİL, `index.ts`'te: render'dan önce çalışmak zorunda.

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

export const isErrorReportingEnabled = Boolean(DSN);

// message: sabit, gruplanabilir bir başlık ("Akış okunamadı"). Değişken veriyi
// (id, sayı) buraya değil `context`'e koy.
//
// DİKKAT: beklenen kullanıcı hatalarını (yanlış kod girildi, rate limit)
// buradan geçirme — kotayı yakar ve gerçek hataları gürültüde boğar. Örnek:
// core/auth'daki `translateAuthError` sadece HİÇBİR desene uymayan mesajı
// rapor ediyor.
export function reportError(message: string, error?: unknown, context?: Record<string, unknown>) {
  console.error(`${message}:`, ...[error, context].filter((value) => value !== undefined));
  if (!isErrorReportingEnabled) return;

  Sentry.captureException(error instanceof Error ? error : new Error(message), {
    // Gruplama başlığa göre: aynı `message` = tek issue. Bu olmadan her farklı
    // ağ hatası metni ayrı bir issue açar ve liste okunmaz hale gelir.
    fingerprint: [message],
    // Supabase hata objesi / string gibi Error olmayan değerler stack trace
    // taşımıyor — ham halini `extra`'ya koyuyoruz ki kaybolmasın.
    extra: { ...context, raw: error instanceof Error ? undefined : error },
  });
}

// Hatayı hangi kullanıcının aldığını görmek triyajın yarısı.
// Sadece Supabase user id (UUID) — e-posta/ad geçirme.
export function setErrorUser(userId: string | null) {
  if (!isErrorReportingEnabled) return;
  Sentry.setUser(userId ? { id: userId } : null);
}
