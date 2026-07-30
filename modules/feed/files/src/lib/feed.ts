import { isSupabaseConfigured, supabase } from "./supabase";

export type Post = {
  id: number;
  user_id: string;
  body: string;
  image_path: string | null;
  created_at: string;
};

export type Comment = {
  id: number;
  post_id: number;
  user_id: string;
  body: string;
  created_at: string;
};

export const PAGE_SIZE = 20;

// ponytail: offset/range yerine keyset pagination (created_at < cursor). OFFSET
// derin sayfalarda yavaşlar VE araya yeni gönderi girerse kayıt atlar/tekrarlar.
export async function fetchPosts(cursor?: string): Promise<Post[]> {
  if (!isSupabaseConfigured || !supabase) return [];

  let query = supabase
    .from("posts")
    .select("id, user_id, body, image_path, created_at")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(PAGE_SIZE);

  if (cursor) query = query.lt("created_at", cursor);

  const { data, error } = await query;
  if (error) {
    console.error("Akış okunamadı:", error);
    return [];
  }
  return (data ?? []) as Post[];
}

export async function createPost(body: string, imagePath?: string): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured || !supabase) return { error: "Supabase yapılandırılmamış." };

  const trimmed = body.trim();
  // Sunucu tarafında CHECK constraint var; buradaki kontrol sadece kullanıcıya
  // anlamlı bir mesaj göstermek için.
  if (trimmed.length === 0) return { error: "Boş gönderi paylaşılamaz." };
  if (trimmed.length > 2000) return { error: "Gönderi en fazla 2000 karakter olabilir." };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum gerekli." };

  const { error } = await supabase
    .from("posts")
    .insert({ user_id: user.id, body: trimmed, image_path: imagePath ?? null });
  return { error: error ? "Gönderi paylaşılamadı." : null };
}

export async function deletePost(id: number): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured || !supabase) return { error: "Supabase yapılandırılmamış." };
  const { error } = await supabase.from("posts").delete().eq("id", id);
  return { error: error ? "Gönderi silinemedi." : null };
}

export async function fetchComments(postId: number): Promise<Comment[]> {
  if (!isSupabaseConfigured || !supabase) return [];
  const { data, error } = await supabase
    .from("comments")
    .select("id, post_id, user_id, body, created_at")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });
  if (error) return [];
  return (data ?? []) as Comment[];
}

export async function createComment(postId: number, body: string): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured || !supabase) return { error: "Supabase yapılandırılmamış." };
  const trimmed = body.trim();
  if (trimmed.length === 0) return { error: "Boş yorum eklenemez." };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum gerekli." };

  const { error } = await supabase
    .from("comments")
    .insert({ post_id: postId, user_id: user.id, body: trimmed });
  return { error: error ? "Yorum eklenemedi." : null };
}

// Liste ekranında tek seferde tüm yorum sayıları.
export async function commentCounts(postIds: number[]): Promise<Record<number, number>> {
  if (!isSupabaseConfigured || !supabase || postIds.length === 0) return {};
  const { data, error } = await supabase.rpc("comment_counts", { p_post_ids: postIds });
  if (error || !data) return {};
  return Object.fromEntries(
    (data as { post_id: number; comment_count: number }[]).map((r) => [r.post_id, r.comment_count])
  );
}
