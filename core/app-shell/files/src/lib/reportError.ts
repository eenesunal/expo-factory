// Yakalanan her hata buradan geçer. Varsayılan sürüm sadece konsola yazar —
// yani `expo start`'ta gördüğün davranışın aynısı, production'da hiçbir yere
// gitmez.
//
// `modules/error-tracking` seçilirse bu dosyanın Sentry'li sürümü bunun
// ÜZERİNE yazılır (core dosyaları modüllerden önce kopyalanıyor, bkz.
// create.mjs'deki `force: true`). Çağıran taraf hiç değişmiyor.
//
// ponytail: sağlayıcı-agnostik arayüz + adapter katmanı YOK — dosyanın
// tamamının ezilmesi zaten aynı işi bedavaya yapıyor. Tavan: aynı anda iki
// sağlayıcıya gönderemezsin. Gerçekten gerekirse o zaman soyutla.

export const isErrorReportingEnabled = false;

// message: sabit, gruplanabilir bir başlık ("Akış okunamadı"). Değişken veriyi
// (id, sayı) buraya değil `context`'e koy — yoksa her hata ayrı bir issue olur.
export function reportError(message: string, error?: unknown, context?: Record<string, unknown>) {
  console.error(`${message}:`, ...[error, context].filter((value) => value !== undefined));
}

// Hatayı hangi kullanıcının aldığını görmek için. Oturum kurulduğunda çağrılır.
// DİKKAT: e-posta/ad gibi kişisel veri geçirme — Supabase user id (UUID) yeter.
export function setErrorUser(_userId: string | null) {}
