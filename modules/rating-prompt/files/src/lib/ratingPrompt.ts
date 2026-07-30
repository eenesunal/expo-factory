import AsyncStorage from "@react-native-async-storage/async-storage";
import * as StoreReview from "expo-store-review";
import { reportError } from "./reportError";

const COUNT_KEY = "rating_success_count";
const ASKED_KEY = "rating_asked";

// Kaçıncı başarılı aksiyondan sonra sorulacak. Çok erken sormak düşük puan
// getirir — kullanıcının uygulamadan fayda gördüğünden emin olacak kadar bekle.
const THRESHOLD = 5;

// Kullanıcı BAŞARILI bir aksiyonu tamamladığında çağır (kaydetti, paylaştı,
// cevabını aldı...). Hata sonrası ASLA çağırma.
//
// ponytail: "en iyi anı" bulan bir puanlama motoru yok — sayaç + tek seferlik
// bayrak. Ceiling: kullanıcı reddetse de "sonra sor" diyemiyor (iOS'un kendi
// dialogu bu ayrımı zaten bize söylemiyor). Yükseltme yolu: kendi ön-dialogunu
// göster ("Beğendin mi?"), olumluysa StoreReview'a geç.
export async function recordSuccessfulAction(): Promise<void> {
  if (await AsyncStorage.getItem(ASKED_KEY)) return;

  const count = Number(await AsyncStorage.getItem(COUNT_KEY)) + 1;
  await AsyncStorage.setItem(COUNT_KEY, String(count));
  if (count < THRESHOLD) return;

  // iOS dialogu gösterip göstermeyeceğine kendi karar veriyor (yılda en fazla
  // 3 kez) ve bize sonucu SÖYLEMİYOR. Bu yüzden bir kez denedikten sonra bir
  // daha denemiyoruz — kullanıcıyı aynı istekle tekrar tekrar rahatsız etmemek
  // için doğru davranış bu.
  await AsyncStorage.setItem(ASKED_KEY, "true");

  if (!(await StoreReview.hasAction())) return;
  try {
    await StoreReview.requestReview();
  } catch (err) {
    reportError("Değerlendirme isteği başarısız", err);
  }
}

// Ayarlar ekranındaki "Bizi değerlendir" butonu için — kullanıcı KENDİSİ
// istediğinde mağaza sayfasını aç (sistem dialogunun kotasını harcamaz).
export async function openStoreListing(): Promise<void> {
  const url = StoreReview.storeUrl();
  if (!url) return;
  const { openURL } = await import("expo-linking");
  await openURL(url);
}

// Test için: sayaç ve bayrağı sıfırla.
export async function resetRatingPrompt(): Promise<void> {
  await AsyncStorage.multiRemove([COUNT_KEY, ASKED_KEY]);
}
