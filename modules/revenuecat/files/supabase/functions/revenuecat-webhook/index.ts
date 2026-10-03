// RevenueCat webhook -> tüketilebilir kredi paketi satın almalarını
// credit_balances'a işler (`credits` modülü kurulu olmalı).
// RevenueCat Dashboard > Project Settings > Integrations > Webhooks içinde bu
// fonksiyonun URL'i ve "Authorization header value" olarak
// REVENUECAT_WEBHOOK_SECRET set edilmeli.
//
// Deploy: supabase functions deploy revenuecat-webhook --no-verify-jwt
// (RevenueCat Supabase JWT'si göndermez — --no-verify-jwt şart.)
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK_SECRET = Deno.env.get("REVENUECAT_WEBHOOK_SECRET")!;

// src/lib/creditProducts.ts ile BİREBİR AYNI olmalı — Deno tarafı o dosyayı
// import edemediği için burada ayrı bir kopya duruyor. Biri değişirse diğeri de
// güncellenmeli, yoksa satın alma sonrası kredi hiç yüklenmez.
const CREDIT_PRODUCTS: Record<string, { pool: string; amount: number }> = {
  kredi_10: { pool: "default", amount: 10 },
  kredi_25: { pool: "default", amount: 25 },
  kredi_50: { pool: "default", amount: 50 },
  kredi_100: { pool: "default", amount: 100 },
};

// Tüketilebilir satın almalar abonelik değil — RENEWAL/EXPIRATION gibi
// abonelik yaşam döngüsü event'leri burada anlamsız.
const PURCHASE_EVENTS = new Set(["INITIAL_PURCHASE", "NON_RENEWING_PURCHASE"]);
const REFUND_EVENTS = new Set(["REFUND", "CANCELLATION"]);

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  // Secret tanımlı değilse karşılaştırma "Bearer undefined" olur ve o başlıkla gelen herkes geçerdi.
  if (!WEBHOOK_SECRET || req.headers.get("Authorization") !== `Bearer ${WEBHOOK_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { event } = await req.json();
  const appUserId = event?.app_user_id as string | undefined;
  const type = event?.type as string | undefined;
  const productId = event?.product_id as string | undefined;
  const transactionId = event?.transaction_id as string | undefined;

  if (!appUserId || !type) return new Response("Bad request", { status: 400 });

  const isPurchase = PURCHASE_EVENTS.has(type);
  const isRefund = REFUND_EVENTS.has(type);
  if (!isPurchase && !isRefund) return new Response("ignored", { status: 200 });

  const product = productId ? CREDIT_PRODUCTS[productId] : undefined;
  if (!product) return new Response("unknown product", { status: 200 });
  if (!transactionId) return new Response("missing transaction_id", { status: 400 });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // rc_transaction_id UNIQUE (bkz. credits/schema.sql) — RevenueCat aynı
  // event'i retry ile birden fazla gönderirse ikinci insert conflict'e düşer ve
  // bakiyeyi bir daha güncellemeden çıkarız. Bu tek koruma katmanı yeterli.
  const signedAmount = isPurchase ? product.amount : -product.amount;
  const { error: insertError } = await supabase.from("credit_transactions").insert({
    user_id: appUserId,
    pool: product.pool,
    amount: signedAmount,
    rc_transaction_id: transactionId,
    reason: isPurchase ? "purchase" : "refund",
  });

  if (insertError) {
    // 23505 = unique_violation — bu transaction zaten işlenmiş.
    if (insertError.code === "23505") return new Response("already processed", { status: 200 });
    return new Response(insertError.message, { status: 500 });
  }

  const { error: creditError } = await supabase.rpc("add_credit", {
    p_user_id: appUserId,
    p_pool: product.pool,
    p_amount: signedAmount,
  });

  if (creditError) return new Response(creditError.message, { status: 500 });

  return new Response("ok", { status: 200 });
});
