import { useCallback, useEffect, useRef, useState } from "react";
import { reportError } from "./reportError";
import { isSupabaseConfigured, supabase } from "./supabase";

export type Message = {
  id: number;
  room_id: string;
  user_id: string;
  body: string;
  created_at: string;
};

const PAGE_SIZE = 50;

export async function sendMessage(roomId: string, body: string): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured || !supabase) return { error: "Supabase yapılandırılmamış." };
  const trimmed = body.trim();
  if (trimmed.length === 0) return { error: null };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum gerekli." };

  const { error } = await supabase
    .from("messages")
    .insert({ room_id: roomId, user_id: user.id, body: trimmed });
  return { error: error ? "Mesaj gönderilemedi." : null };
}

// Oda mesajları + canlı güncelleme + kimlerin çevrimiçi olduğu.
export function useChat(roomId: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [online, setOnline] = useState(0);
  const [loading, setLoading] = useState(true);
  // Kendi INSERT'imiz hem optimistik ekleme hem de realtime event olarak iki
  // kez gelebiliyor — id bazlı tekilleştirme.
  const seen = useRef(new Set<number>());

  const append = useCallback((message: Message) => {
    if (seen.current.has(message.id)) return;
    seen.current.add(message.id);
    setMessages((prev) => [...prev, message]);
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setLoading(false);
      return;
    }
    const client = supabase;
    let active = true;
    seen.current = new Set();
    setMessages([]);

    client
      .from("messages")
      .select("id, room_id, user_id, body, created_at")
      .eq("room_id", roomId)
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE)
      .then(({ data, error }) => {
        if (!active) return;
        if (error) reportError("Mesajlar okunamadı", error);
        const rows = ((data ?? []) as Message[]).reverse();
        rows.forEach((m) => seen.current.add(m.id));
        setMessages(rows);
        setLoading(false);
      });

    const channel = client
      .channel(`room:${roomId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `room_id=eq.${roomId}` },
        (payload) => append(payload.new as Message)
      )
      .on("presence", { event: "sync" }, () => {
        setOnline(Object.keys(channel.presenceState()).length);
      })
      .subscribe(async (status) => {
        if (status !== "SUBSCRIBED") return;
        const {
          data: { user },
        } = await client.auth.getUser();
        // presence key olarak user id — aynı kullanıcının iki cihazı tek
        // "çevrimiçi" sayılır.
        await channel.track({ user_id: user?.id ?? "anon", at: Date.now() });
      });

    return () => {
      active = false;
      // Kanalı kapatmak ZORUNLU — Realtime eşzamanlı bağlantı kotasına tabi,
      // kapatmazsan ekranlar arası gezindikçe bağlantılar birikir.
      client.removeChannel(channel);
    };
  }, [roomId, append]);

  return { messages, online, loading };
}
