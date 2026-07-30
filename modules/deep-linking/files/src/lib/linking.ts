import * as Linking from "expo-linking";
import type { LinkingOptions } from "@react-navigation/native";
import type { RootStackParamList } from "./navigation";

// KURULUM: App.tsx'teki <NavigationContainer>'a bu prop'u ekle —
//   <NavigationContainer ref={navigationRef} linking={linking}>
// Bu tek satır olmadan hiçbir link ekrana düşmez.
//
// React Navigation gelen URL'i kendisi çözer ve doğru ekrana gider; uygulama
// kapalıyken açılan linki de (initial URL) aynı yapı hallediyor — bunun için
// ayrı bir kod yazmak gerekmiyor.
export const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [
    // Custom scheme: __APP_SLUG__://...  (her zaman çalışır, kurulum gerektirmez)
    Linking.createURL("/"),
    // Universal / app links: https://__DOMAIN__/...
    // (.well-known dosyaları yayınlanmadan çalışmaz, bkz. README)
    "https://__DOMAIN__",
  ],
  config: {
    screens: {
      Home: "",
      Account: "hesap",
      // Kendi ekranlarını ekle. Parametreli örnek:
      //   Feed: "akis/:postId",
      // Parametre tipini RootStackParamList'te tanımlaman gerekir.
    },
  },
};

// Paylaşılabilir bir link üretmek için — universal link kurulmadıysa custom
// scheme'e düşer.
export function shareableUrl(path: string): string {
  const domain = "__DOMAIN__";
  return domain && domain !== "example.com"
    ? `https://${domain}/${path.replace(/^\//, "")}`
    : Linking.createURL(path);
}
