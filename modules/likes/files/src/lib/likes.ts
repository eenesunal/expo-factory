import { isSupabaseConfigured, supabase } from "./supabase";

// Beğeni hassas bir işlem değil (kredi harcamak gibi) — edge function'a gerek
// yok, anon key + kullanıcı JWT'siyle doğrudan RPC.
export async function toggleLike(entityId: string): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) return false;
  const { data, error } = await supabase.rpc("toggle_like", { p_entity_id: entityId });
  if (error) throw error;
  return Boolean(data);
}

export async function isLiked(entityId: string): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) return false;
  const { data, error } = await supabase.rpc("is_liked", { p_entity_id: entityId });
  if (error) return false;
  return Boolean(data);
}

// Liste ekranlarında tek seferde tüm sayılar — her satır için ayrı sorgu atma.
export async function likeCounts(entityIds: string[]): Promise<Record<string, number>> {
  if (!isSupabaseConfigured || !supabase || entityIds.length === 0) return {};
  const { data, error } = await supabase.rpc("like_counts", { p_entity_ids: entityIds });
  if (error || !data) return {};
  return Object.fromEntries(
    (data as { entity_id: string; like_count: number }[]).map((r) => [r.entity_id, r.like_count])
  );
}

export async function topLiked(limit = 20): Promise<{ entityId: string; likeCount: number }[]> {
  if (!isSupabaseConfigured || !supabase) return [];
  const { data, error } = await supabase.rpc("top_liked", { p_limit: limit });
  if (error || !data) return [];
  return (data as { entity_id: string; like_count: number }[]).map((r) => ({
    entityId: r.entity_id,
    likeCount: r.like_count,
  }));
}
