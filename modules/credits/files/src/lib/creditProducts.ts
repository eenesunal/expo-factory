// Kredi paketi ürün ID'leri.
//
// `revenuecat` modülünü de kurduysan: bu ID'ler App Store Connect'te aynı
// isimle **Consumable** IAP olarak oluşturulmalı ve RevenueCat'te tek bir
// Offering altında Package olarak eklenmeli.
//
// DİKKAT: aynı liste `supabase/functions/revenuecat-webhook/index.ts` içinde de
// duruyor (Deno tarafı bu dosyayı import edemez). Biri değişirse diğeri de
// güncellenmeli — yoksa satın alma sonrası kredi hiç yüklenmez.
export type CreditProduct = {
  id: string;
  pool: string;
  amount: number;
};

export const CREDIT_PRODUCTS: CreditProduct[] = [
  { id: "kredi_10", pool: "default", amount: 10 },
  { id: "kredi_25", pool: "default", amount: 25 },
  { id: "kredi_50", pool: "default", amount: 50 },
  { id: "kredi_100", pool: "default", amount: 100 },
];

export function creditProductsFor(pool: string): CreditProduct[] {
  return CREDIT_PRODUCTS.filter((p) => p.pool === pool);
}
