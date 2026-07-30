import { isSupabaseConfigured, supabase } from "./supabase";

export type AnswerDocument = {
  entity_id: string;
  reference_label: string;
  content: string;
};

export type Answer = {
  question: string;
  notFound: boolean;
  documents: AnswerDocument[];
  commentary: string | null;
  // `credits` modülü + RAG_CREDIT_POOL kuruluysa kalan kredi, aksi halde null.
  remaining: number | null;
};

export type AskResult = { answer: Answer; error: null } | { answer: null; error: string };

export async function ask(question: string): Promise<AskResult> {
  if (!isSupabaseConfigured || !supabase) {
    return { answer: null, error: "Supabase yapılandırılmamış." };
  }

  const { data, error } = await supabase.functions.invoke("ask-question", {
    body: { question },
  });

  if (error) {
    // Edge function'ın gövdesindeki Türkçe hata mesajını kullanıcıya
    // gösterebilmek için context'i okumaya çalışıyoruz (kredi bitti gibi
    // durumlarda 429 + anlamlı mesaj dönüyor).
    const body = await error.context?.json?.().catch(() => null);
    return { answer: null, error: body?.error ?? "Cevap alınamadı. Lütfen tekrar dene." };
  }

  return { answer: data as Answer, error: null };
}
