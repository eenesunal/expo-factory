import { isSupabaseConfigured, supabase } from "./supabase";

// SQL tarafı makine-okunur kodlar atıyor; kullanıcıya gösterilecek metni
// burada üretiyoruz (edge function yok, mesajları veritabanına gömmüyoruz).
const ERROR_MESSAGES: Record<string, string> = {
  AUTH_REQUIRED: "Bunun için giriş yapmalısın.",
  ALREADY_REDEEMED: "Daha önce bir davet kodu kullanmışsın.",
  INVALID_CODE: "Bu kod geçersiz. Yazımını kontrol et.",
  SELF_REFERRAL: "Kendi kodunu kullanamazsın.",
};

export async function getMyReferralCode(): Promise<string | null> {
  if (!isSupabaseConfigured || !supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("referral_code")
    .eq("id", user.id)
    .single();
  if (error || !data) return null;
  return data.referral_code;
}

export async function redeemReferral(
  code: string
): Promise<{ reward: number | null; error: string | null }> {
  if (!isSupabaseConfigured || !supabase) return { reward: null, error: "Supabase yapılandırılmamış." };

  const { data, error } = await supabase.rpc("redeem_referral", { p_code: code });
  if (error) {
    const key = Object.keys(ERROR_MESSAGES).find((k) => error.message.includes(k));
    return { reward: null, error: key ? ERROR_MESSAGES[key] : "Kod kullanılamadı. Lütfen tekrar dene." };
  }
  return { reward: data as number, error: null };
}
