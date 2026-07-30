import { useEffect, useState } from "react";
import Purchases from "react-native-purchases";
import { isRevenueCatConfigured } from "./purchases";
import { reportError } from "./reportError";

// ABONELİK entitlement'ı — tüketilebilir kredi değil. Kredi bazlı model için
// `credits` modülüne bak.
export async function hasEntitlement(entitlement: string): Promise<boolean> {
  if (!isRevenueCatConfigured) return false;
  try {
    const info = await Purchases.getCustomerInfo();
    return Boolean(info.entitlements.active[entitlement]);
  } catch (err) {
    // Ağ hatasında kapalı varsayıyoruz. Çevrimdışıyken de açık kalmasını
    // istiyorsan RevenueCat'in kendi cache'i zaten son bilinen durumu döner —
    // burada patlaması ancak SDK hiç configure edilmediyse olur.
    reportError("Entitlement okunamadı", err);
    return false;
  }
}

// Satın alma tamamlandığında otomatik güncellenir (RevenueCat'in
// customerInfo listener'ı) — ekranı elle yenilemek gerekmez.
export function useEntitlement(entitlement: string) {
  const [state, setState] = useState<{ active: boolean; loading: boolean }>({
    active: false,
    loading: true,
  });

  useEffect(() => {
    let mounted = true;

    function apply(active: boolean) {
      if (mounted) setState({ active, loading: false });
    }

    hasEntitlement(entitlement).then(apply);

    if (!isRevenueCatConfigured) return () => { mounted = false; };

    const listener = (info: { entitlements: { active: Record<string, unknown> } }) =>
      apply(Boolean(info.entitlements.active[entitlement]));
    Purchases.addCustomerInfoUpdateListener(listener);

    return () => {
      mounted = false;
      Purchases.removeCustomerInfoUpdateListener(listener);
    };
  }, [entitlement]);

  return state;
}
