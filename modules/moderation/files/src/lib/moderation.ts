import { reportError } from "./reportError";
import { isSupabaseConfigured, supabase } from "./supabase";

export type ReportTarget = { type: string; id: string };

export async function reportContent(
  target: ReportTarget,
  reason: string
): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured || !supabase) return { error: "Supabase yapılandırılmamış." };
  const trimmed = reason.trim();
  if (trimmed.length === 0) return { error: "Lütfen bir sebep yaz." };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum gerekli." };

  const { error } = await supabase.from("reports").insert({
    reporter_id: user.id,
    target_type: target.type,
    target_id: target.id,
    reason: trimmed,
  });

  // 23505 = unique_violation: aynı içeriği ikinci kez raporlamak hata değil,
  // kullanıcıya "aldık" demek yeterli.
  if (error && error.code !== "23505") {
    reportError("Rapor gönderilemedi", error);
    return { error: "Rapor gönderilemedi. Lütfen tekrar dene." };
  }
  return { error: null };
}

export async function blockUser(userId: string): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured || !supabase) return { error: "Supabase yapılandırılmamış." };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum gerekli." };
  if (user.id === userId) return { error: "Kendini engelleyemezsin." };

  const { error } = await supabase
    .from("blocks")
    .upsert({ blocker_id: user.id, blocked_id: userId }, { onConflict: "blocker_id,blocked_id" });
  return { error: error ? "Kullanıcı engellenemedi." : null };
}

export async function unblockUser(userId: string): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured || !supabase) return { error: "Supabase yapılandırılmamış." };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum gerekli." };

  const { error } = await supabase
    .from("blocks")
    .delete()
    .eq("blocker_id", user.id)
    .eq("blocked_id", userId);
  return { error: error ? "Engel kaldırılamadı." : null };
}

// Liste sorgularında engellenen kullanıcıların içeriğini filtrelemek için.
// Engelleme yalnızca gösterimi etkiler (veri silinmez) — Apple'ın istediği de bu.
export async function blockedUserIds(): Promise<string[]> {
  if (!isSupabaseConfigured || !supabase) return [];
  const { data, error } = await supabase.from("blocks").select("blocked_id");
  if (error || !data) return [];
  return data.map((r: { blocked_id: string }) => r.blocked_id);
}
