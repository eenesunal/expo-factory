import { isSupabaseConfigured, supabase } from "./supabase";

// Kullanıcının tüm havuzlardaki bakiyesi: { default: 5, image: 2 }
export async function getMyCredits(): Promise<Record<string, number>> {
  if (!isSupabaseConfigured || !supabase) return {};

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return {};

  const { data, error } = await supabase
    .from("credit_balances")
    .select("pool, balance")
    .eq("user_id", user.id);

  if (error || !data) return {};
  return Object.fromEntries(data.map((row) => [row.pool, row.balance]));
}

export async function getMyCredit(pool: string): Promise<number> {
  return (await getMyCredits())[pool] ?? 0;
}

// Kredi HARCAMA client'ta yapılmaz — `spend_credit` RPC'si sadece service_role'e
// açık. Kredili bir işlemi bir edge function'a koy, orada şu sırayı izle:
//
//   1. spend_credit çağır; null dönerse 429 + "kredi yetersiz" dön
//   2. credit_transactions'a reason:'spend' kaydı at
//   3. asıl işi yap
//   4. iş BAŞARISIZ olursa add_credit ile krediyi geri ver
//
// 4. adımı atlamak, kullanıcının hatalı bir istekte kredi kaybetmesi demek —
// Hafız'da LLM cevabı parse edilemediğinde bu unutulmuştu.
