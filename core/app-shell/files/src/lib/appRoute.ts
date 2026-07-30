export type AppRoute = "splash" | "main";

// Açılışta hangi ekranın gösterileceğini belirler. Oturumun GERÇEK bir hesaba
// (email'li) bağlı olup olmadığına bakmaz — anonim oturum da yeterli, çünkü
// Apple Guideline 5.1.1(v) hesaba bağlı olmayan özelliklerin giriş yapmadan
// erişilebilir olmasını istiyor.
export function resolveAppRoute(params: {
  sessionReady: boolean;
  minSplashElapsed: boolean;
}): AppRoute {
  return params.sessionReady && params.minSplashElapsed ? "main" : "splash";
}
