import { Platform } from "react-native";
import Purchases, {
  LOG_LEVEL,
  type CustomerInfo,
  type PurchasesOffering,
  type PurchasesPackage,
} from "react-native-purchases";

const IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;
const ANDROID_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;

export const isRevenueCatConfigured = Boolean(Platform.OS === "ios" ? IOS_KEY : ANDROID_KEY);

let configured = false;

// RevenueCat'i Supabase user id'sini appUserID olarak kullanarak başlatır —
// webhook tarafında event.app_user_id ile kullanıcı eşleştirilebilsin diye.
// ensureSession()'dan SONRA çağrılmalı.
//
// DİKKAT: try/catch ile sar. Native/JS sürüm uyuşmazlığı gibi bir sebeple
// patlarsa oturum akışı bundan etkilenmemeli — satın alma çalışmasa da
// uygulama açılmalı.
export function configurePurchases(appUserID: string) {
  if (!isRevenueCatConfigured || configured) return;
  const apiKey = Platform.OS === "ios" ? IOS_KEY! : ANDROID_KEY!;
  if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.WARN);
  Purchases.configure({ apiKey, appUserID });
  configured = true;
}

export async function getOffering(): Promise<PurchasesOffering | null> {
  if (!isRevenueCatConfigured) return null;
  const offerings = await Purchases.getOfferings();
  return offerings.current;
}

export async function purchasePackage(pkg: PurchasesPackage) {
  return Purchases.purchasePackage(pkg);
}

// Var olan bir hesaba giriş yapıldığında RevenueCat identity'sini de o hesabın
// user id'sine geçirir — yoksa satın almalar configurePurchases'ın ilk
// çağrıldığı anonim ID'de asılı kalır.
export async function switchPurchasesUser(appUserID: string) {
  if (!isRevenueCatConfigured || !configured) return;
  await Purchases.logIn(appUserID);
}

// Cihaz değiştirme / yeniden kurulum sonrası — Apple abonelikli uygulamalarda
// görünür bir "Satın Almaları Geri Yükle" butonu İSTİYOR (Guideline 3.1.1).
export async function restorePurchases(): Promise<CustomerInfo | null> {
  if (!isRevenueCatConfigured || !configured) return null;
  return Purchases.restorePurchases();
}

export type { CustomerInfo, PurchasesOffering, PurchasesPackage };
