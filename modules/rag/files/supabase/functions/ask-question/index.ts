// Soru al -> guardrail -> (opsiyonel) kredi düş -> cache kontrolü -> hibrit
// arama -> LLM'e sadece bulunan belgeleri ver -> cevabı kaydet ve dön.
//
// Deploy: supabase functions deploy ask-question
// Secrets: supabase secrets set OPENAI_API_KEY=... ANTHROPIC_API_KEY=...
//          (opsiyonel) supabase secrets set RAG_CREDIT_POOL=default
import { createClient } from "jsr:@supabase/supabase-js@2";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// Set edilmezse kredi mantığı tamamen atlanır (`credits` modülü kurulu değilse).
const CREDIT_POOL = Deno.env.get("RAG_CREDIT_POOL");

const MIN_QUESTION_LENGTH = 3;
const MAX_QUESTION_LENGTH = 300;
const MATCH_COUNT = 15;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Kendi alanına göre düzenle. Değiştirmeyeceğin kısım: "SADECE verilen
// kaynaklara dayan" ve "ilgili bilgi yoksa found:false".
const SYSTEM_PROMPT = `Sana verilen kaynak parçalarını kullanarak kullanıcının sorusunu yanıtla.

Kurallar:
- SADECE verilen kaynaklara dayan. Kendi bilgini veya yorumunu katma.
- Verilen kaynaklarda soruyla doğrudan ilgili bir bilgi yoksa found:false döndür, entity_ids boş kalsın.
- found:true ise, konuyla GERÇEKTEN ilgili kaynakların id'lerini entity_ids dizisine ekle. Alakasız olanları dahil etme; az sayıda gerçekten ilgili kaynak varsa listeyi doldurmak için zorlama.
- entity_ids'e YALNIZCA sana verilen bağlamdaki [id] etiketlerinde geçen id'leri, aynen kopyalayarak yaz. Yeni bir id uydurma, biçimini değiştirme.
- commentary alanına akıcı, doğal Türkçeyle 3-5 cümlelik bir paragraf yaz: kaynakların ne söylediğini özetle ve kullanıcının somut durumuna nasıl uygulanacağına dair bir cümle ekle.`;

// LLM'den YALNIZCA yapısal veri (id) istiyoruz — insan-okunur etiketi
// (reference_label) veritabanından deterministik olarak biz okuyoruz.
// Bkz. TUZAK #6: serbest metin alanı yazdırdığında model bazen var olmayan bir
// isim uydurur.
const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    found: { type: "boolean" },
    entity_ids: { type: "array", items: { type: "string" } },
    commentary: { type: "string" },
  },
  required: ["found", "entity_ids", "commentary"],
  additionalProperties: false,
};

type Doc = { entity_id: string; reference_label: string; content: string };

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

async function embed(text: string): Promise<number[]> {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({ model: "text-embedding-3-small", input: text }),
  });
  if (!res.ok) throw new Error(`OpenAI embedding hatası: ${await res.text()}`);
  const data = await res.json();
  return data.data[0].embedding;
}

async function haiku(system: string, user: string, maxTokens: number, schema?: unknown) {
  return fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5",
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: user }],
      ...(schema ? { output_config: { format: { type: "json_schema", schema } } } : {}),
    }),
  });
}

function textOf(messageData: { content?: { type: string; text?: string }[] }): string {
  return messageData.content?.find((b) => b.type === "text")?.text ?? "";
}

const KEYWORD_EXTRACTION_PROMPT = `Kullanıcının sorusundan, bir metin arşivinde arama yapmak için en AYIRT EDİCİ 1-3 kelimeyi çıkar.

SADECE sorunun konusunu belirleyen fiil/eylem veya nadir kelimeleri seç. Onlarca kayıtta geçebilecek jenerik isimleri ASLA seçme. Kelimeleri mastar/kök haliyle yaz (ör. "dövebilir miyim" -> "dövmek"). Sadece kelimeleri virgülle ayırarak döndür, başka hiçbir şey yazma.`;

// Sorular günlük dille yazılır ama korpus farklı bir üslupta olabilir; trigram
// arama bu ek/üslup farkını köprüleyemiyor. Lexical taraf için mastar haline
// çevrilmiş, ayırt edici anahtar kelimeler çıkarıyoruz.
// Embedding için ORİJİNAL soru kullanılmaya devam ediyor — kelime listesi
// embedding kalitesini bozuyor.
async function extractSearchKeywords(question: string): Promise<string> {
  const res = await haiku(KEYWORD_EXTRACTION_PROMPT, question, 64);
  if (!res.ok) return question;
  // Orijinal soruyla BİRLEŞTİRMİYORUZ: gramer ekleri geri karışıp aynı
  // kirliliği yaratıyor.
  return textOf(await res.json()).trim() || question;
}

function normalizeQuestion(question: string): string {
  return question.trim().toLowerCase().replace(/\s+/g, " ");
}

// TUZAK #7: cache'lenmiş bir satır, response şeması değişmeden önce yazılmış
// olabilir (yeni bir alan eklediğinde eski satırlar onu içermez) ve client'ta
// "undefined" kırılmalarına yol açar. Cache'i YALNIZCA beklenen şekle uyuyorsa
// kullan, uymuyorsa atlayıp yeniden üret.
function isCachedAnswerValid(cached: { entity_ids: unknown; commentary: unknown; not_found: boolean }): boolean {
  if (cached.not_found) return true;
  if (typeof cached.commentary !== "string" || cached.commentary.length === 0) return false;
  const ids = cached.entity_ids;
  return Array.isArray(ids) && ids.length > 0 && ids.every((id) => typeof id === "string");
}

// "Bu kategorinin TAMAMI" soruları (ör. "X koleksiyonunda neler var") tekil
// benzerlik aramasıyla çözülmüyor: kategori adı belgelerin İÇİNDE geçmiyor ve
// vektör araması o kategoriye özgü olmayan rastgele belgeler buluyor — LLM de
// haklı olarak found:false dönüyor. Soru açıkça bir kategoriyi işaret ediyorsa o
// kategorinin TÜM belgelerini doğrudan çekmek çok daha güvenilir.
async function detectCategory(question: string, categories: string[]): Promise<string | null> {
  if (categories.length === 0) return null;
  const prompt = `Kullanıcının sorusu aşağıdaki kategorilerden BİRİNİN tamamından/genelinden mi bahsediyor?

Kategoriler: ${categories.join(", ")}

Öyleyse SADECE o kategorinin adını aynen yaz, başka hiçbir şey yazma. Soru belirli bir kategoriyi değil genel bir konuyu soruyorsa SADECE "yok" yaz.`;

  const res = await haiku(prompt, question, 32);
  if (!res.ok) return null;
  const answer = textOf(await res.json()).trim();
  return categories.includes(answer) ? answer : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: CORS_HEADERS });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return jsonResponse({ error: "Yetkilendirme gerekli" }, 401);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonResponse({ error: "Geçersiz oturum" }, 401);

  const { question: rawQuestion } = await req.json();
  const question = typeof rawQuestion === "string" ? rawQuestion.trim() : "";

  // Trust boundary — kullanıcı girdisi doğrulanmadan LLM'e/DB'ye gitmez.
  if (question.length < MIN_QUESTION_LENGTH) {
    return jsonResponse({ error: "Soru çok kısa. Lütfen daha açık bir şekilde sorun." }, 400);
  }
  if (question.length > MAX_QUESTION_LENGTH) {
    return jsonResponse({ error: "Soru çok uzun. Lütfen daha kısa ve öz sorun." }, 400);
  }
  if (!/[a-zA-ZçğıöşüÇĞİÖŞÜ]/.test(question)) {
    return jsonResponse({ error: "Lütfen anlamlı bir soru yazın." }, 400);
  }

  // ---- kredi (opsiyonel) ----
  async function refundCredit() {
    if (!CREDIT_POOL) return;
    await supabase.rpc("add_credit", { p_user_id: user!.id, p_pool: CREDIT_POOL, p_amount: 1 });
  }

  let remaining: number | null = null;
  if (CREDIT_POOL) {
    const { data: afterSpend, error: spendError } = await supabase.rpc("spend_credit", {
      p_user_id: user.id,
      p_pool: CREDIT_POOL,
      p_amount: 1,
    });
    if (spendError) return jsonResponse({ error: spendError.message }, 500);
    if (afterSpend === null) {
      return jsonResponse({ error: "Hakkınız kalmadı. Kredi satın alarak devam edebilirsiniz.", remaining: 0 }, 429);
    }
    remaining = afterSpend as number;
    await supabase
      .from("credit_transactions")
      .insert({ user_id: user.id, pool: CREDIT_POOL, amount: -1, reason: "spend" });
  }

  // ---- cache ----
  const normalized = normalizeQuestion(question);
  const { data: cachedRows } = await supabase
    .from("rag_answers")
    .select("entity_ids, commentary, not_found")
    .eq("question_normalized", normalized)
    .limit(1);

  if (cachedRows && cachedRows.length > 0 && isCachedAnswerValid(cachedRows[0])) {
    const cached = cachedRows[0];
    await supabase.from("rag_answers").insert({
      user_id: user.id,
      question,
      entity_ids: cached.entity_ids,
      commentary: cached.commentary,
      not_found: cached.not_found,
    });
    const documents = await lookupDocuments(supabase, cached.entity_ids as string[]);
    return jsonResponse({
      question,
      notFound: cached.not_found,
      documents,
      commentary: cached.commentary,
      remaining,
    });
  }

  // ---- arama ----
  let candidates: Doc[] = [];

  const { data: categoryRows } = await supabase.from("rag_documents").select("category").not("category", "is", null);
  const categories = [...new Set((categoryRows ?? []).map((r: { category: string }) => r.category))];
  const category = await detectCategory(question, categories);

  if (category) {
    const { data, error } = await supabase
      .from("rag_documents")
      .select("entity_id, reference_label, content")
      .eq("category", category)
      .order("sort_key", { ascending: true, nullsFirst: false });
    if (error) {
      await refundCredit();
      return jsonResponse({ error: error.message }, 500);
    }
    candidates = data ?? [];
  } else {
    const [queryEmbedding, searchKeywords] = await Promise.all([
      embed(question),
      extractSearchKeywords(question),
    ]);
    const { data, error } = await supabase.rpc("match_documents", {
      query_embedding: queryEmbedding,
      query_text: searchKeywords,
      match_count: MATCH_COUNT,
    });
    if (error) {
      await refundCredit();
      return jsonResponse({ error: error.message }, 500);
    }
    candidates = data ?? [];
  }

  // ---- LLM ----
  const context = candidates.map((d) => `[${d.entity_id}] ${d.content}`).join("\n");

  // max_tokens: 1024 uzun cevaplarda (çok kaynak + 3-5 cümle) yetmiyordu; model
  // çıktısı token limitinde yarıda kesilip JSON.parse'ı "Unterminated string"
  // ile patlatıyordu. entity_ids şeması metin taşımadığı için artık çok daha
  // ucuz ama pay bırakıyoruz.
  const messageRes = await haiku(
    SYSTEM_PROMPT,
    `Kaynaklar:\n${context}\n\nSoru: ${question}`,
    2048,
    RESPONSE_SCHEMA
  );

  if (!messageRes.ok) {
    await refundCredit();
    return jsonResponse({ error: `Claude API hatası: ${await messageRes.text()}` }, 500);
  }

  const raw = textOf(await messageRes.json());
  let result: { found: boolean; entity_ids?: unknown; commentary?: string };
  try {
    result = JSON.parse(raw);
  } catch (err) {
    // Kurtarılamaz bir yanıtta kullanıcıyı hem hatasız hem de kredisiz
    // bırakmıyoruz: krediyi iade edip anlaşılır bir hata dönüyoruz.
    console.error("LLM yanıtı JSON olarak parse edilemedi:", err, raw);
    await refundCredit();
    return jsonResponse({ error: "Cevap oluşturulurken bir sorun oluştu. Lütfen tekrar deneyin." }, 500);
  }

  // LLM'in döndüğü id'leri KENDİ korpusumuzla kesiştiriyoruz — uydurulmuş ya da
  // biçimi bozulmuş bir id sessizce düşer.
  const known = new Set(candidates.map((d) => d.entity_id));
  const entityIds = (Array.isArray(result.entity_ids) ? result.entity_ids : [])
    .filter((id): id is string => typeof id === "string" && known.has(id));

  await supabase.from("rag_answers").insert({
    user_id: user.id,
    question,
    entity_ids: entityIds,
    commentary: result.commentary ?? null,
    not_found: !result.found || entityIds.length === 0,
  });

  return jsonResponse({
    question,
    notFound: !result.found || entityIds.length === 0,
    // reference_label'ı LLM'den DEĞİL, candidates'tan alıyoruz (TUZAK #6).
    documents: candidates.filter((d) => entityIds.includes(d.entity_id)),
    commentary: result.commentary ?? null,
    remaining,
  });
});

// Cache'ten dönerken belge metinlerini/etiketlerini tazeden okuruz — cache
// sadece "hangi id'ler + yorum" bilgisini tutuyor, metnin kendisini değil.
// Böylece korpus güncellenince eski cevaplar da güncel metni gösterir.
async function lookupDocuments(
  supabase: ReturnType<typeof createClient>,
  entityIds: string[]
): Promise<Doc[]> {
  if (entityIds.length === 0) return [];
  const { data } = await supabase
    .from("rag_documents")
    .select("entity_id, reference_label, content")
    .in("entity_id", entityIds);
  // .in() sıralamayı korumaz — LLM'in verdiği sırayı geri kuruyoruz.
  const byId = new Map((data ?? []).map((d: Doc) => [d.entity_id, d]));
  return entityIds.map((id) => byId.get(id)).filter((d): d is Doc => Boolean(d));
}
