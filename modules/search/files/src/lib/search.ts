import { isSupabaseConfigured, supabase } from "./supabase";

export type SearchHit = {
  entityId: string;
  title: string;
  content: string | null;
  score: number;
};

// ponytail: debounce/iptal mantığı burada değil çağıran tarafta — arama girdisi
// her ekranda farklı davranıyor (anında mı, butonla mı). Basit bir debounce:
//   useEffect(() => { const id = setTimeout(() => run(q), 250); return () => clearTimeout(id); }, [q])
export async function search(query: string, limit = 20): Promise<SearchHit[]> {
  const trimmed = query.trim();
  // 3 karakterin altında trigram araması anlamsız sonuç veriyor (her şeye
  // benziyor) — boşa sorgu atmıyoruz.
  if (!isSupabaseConfigured || !supabase || trimmed.length < 3) return [];

  const { data, error } = await supabase.rpc("search_text", { p_query: trimmed, p_limit: limit });
  if (error || !data) {
    if (error) console.error("Arama hatası:", error);
    return [];
  }
  return (data as { entity_id: string; title: string; content: string | null; score: number }[]).map(
    (row) => ({ entityId: row.entity_id, title: row.title, content: row.content, score: row.score })
  );
}

// Kendi verini arama index'ine yazmak için (kayıt oluşturunca/güncelleyince çağır).
export async function indexItem(item: {
  entityId: string;
  title: string;
  content?: string;
}): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured || !supabase) return { error: "Supabase yapılandırılmamış." };
  const { error } = await supabase.from("search_items").upsert(
    {
      entity_id: item.entityId,
      title: item.title,
      content: item.content ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "entity_id" }
  );
  return { error: error ? "Arama index'i güncellenemedi." : null };
}
