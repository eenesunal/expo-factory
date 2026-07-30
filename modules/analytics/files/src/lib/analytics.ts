import PostHog from "posthog-react-native";

const API_KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY;
const HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com";

// ponytail: provider-agnostik bir "analytics arayüzü" + adapter katmanı YOK.
// Tek bir sağlayıcı kullanıyorsun; ikincisi gerçekten gelirse o zaman soyutlarsın.
// Buradaki tek amaç: key yoksa çağrıların sessizce hiçbir şey yapması, böylece
// analytics'i sonradan eklemek/çıkarmak kod değişikliği gerektirmiyor.
const client = API_KEY ? new PostHog(API_KEY, { host: HOST }) : null;

export const isAnalyticsEnabled = Boolean(client);

// DİKKAT: kişisel veri (e-posta, ad, tam konum) event property'sine koymayın.
// Kullanıcıyı ilişkilendirmek için identify() var.
export function track(event: string, properties?: Record<string, unknown>) {
  client?.capture(event, properties);
}

export function screen(name: string, properties?: Record<string, unknown>) {
  client?.screen(name, properties);
}

// Anonim oturumdan gerçek hesaba geçildiğinde çağır — önceki anonim olaylar bu
// kimliğe bağlanır.
export function identify(userId: string, properties?: Record<string, unknown>) {
  client?.identify(userId, properties);
}

export function resetAnalytics() {
  client?.reset();
}
