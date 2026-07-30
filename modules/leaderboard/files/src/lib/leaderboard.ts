import { reportError } from "./reportError";
import { isSupabaseConfigured, supabase } from "./supabase";

export type ScoreRow = { rank: number; userId: string; score: number };

// mode: 'max' = sadece daha iyiyse yaz (yüksek skor), 'add' = mevcut skora ekle,
// 'set' = koşulsuz yaz.
export async function submitScore(
  score: number,
  options?: { board?: string; mode?: "max" | "set" | "add" }
): Promise<number | null> {
  if (!isSupabaseConfigured || !supabase) return null;
  const { data, error } = await supabase.rpc("submit_score", {
    p_score: score,
    p_board: options?.board ?? "default",
    p_mode: options?.mode ?? "max",
  });
  if (error) {
    reportError("Skor kaydedilemedi", error);
    return null;
  }
  return data as number;
}

export async function topScores(board = "default", limit = 20): Promise<ScoreRow[]> {
  if (!isSupabaseConfigured || !supabase) return [];
  const { data, error } = await supabase.rpc("top_scores", { p_board: board, p_limit: limit });
  if (error || !data) return [];
  return (data as { rank: number; user_id: string; score: number }[]).map((r) => ({
    rank: r.rank,
    userId: r.user_id,
    score: r.score,
  }));
}

// İlk N'de olmasa da kullanıcının kendi sırasını göstermek için.
export async function myRank(board = "default"): Promise<{ rank: number; score: number } | null> {
  if (!isSupabaseConfigured || !supabase) return null;
  const { data, error } = await supabase.rpc("my_rank", { p_board: board });
  if (error || !data || (data as unknown[]).length === 0) return null;
  const row = (data as { rank: number; score: number }[])[0];
  return { rank: row.rank, score: row.score };
}
