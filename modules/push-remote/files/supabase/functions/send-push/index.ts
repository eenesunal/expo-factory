// Bir veya daha fazla kullanıcıya uzaktan push gönderir.
//
// SUNUCUDAN SUNUCUYA bir fonksiyon: PUSH_ADMIN_SECRET ile korunuyor ve bu
// secret UYGULAMAYA GÖMÜLMEMELİ. Cron job, admin script'i ya da başka bir
// backend'den çağır.
//
// Deploy: supabase functions deploy send-push --no-verify-jwt
// Secret:  supabase secrets set PUSH_ADMIN_SECRET=<rastgele>
//
// Örnek:
//   curl -X POST "$SUPABASE_URL/functions/v1/send-push" \
//     -H "Authorization: Bearer $PUSH_ADMIN_SECRET" \
//     -H "Content-Type: application/json" \
//     -d '{"userIds":["..."],"title":"Merhaba","body":"Yeni bir şey var","data":{"screen":"Feed"}}'
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ADMIN_SECRET = Deno.env.get("PUSH_ADMIN_SECRET")!;

// Expo push API tek istekte en fazla 100 mesaj alıyor.
const CHUNK = 100;

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (req.headers.get("Authorization") !== `Bearer ${ADMIN_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { userIds, title, body, data } = await req.json();
  if (!Array.isArray(userIds) || userIds.length === 0 || !title || !body) {
    return new Response("userIds, title ve body gerekli", { status: 400 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: rows, error } = await supabase
    .from("push_tokens")
    .select("expo_push_token")
    .in("user_id", userIds);

  if (error) return new Response(error.message, { status: 500 });

  const tokens = (rows ?? []).map((r: { expo_push_token: string }) => r.expo_push_token);
  if (tokens.length === 0) {
    return Response.json({ sent: 0, note: "Bu kullanıcıların kayıtlı push token'ı yok" });
  }

  const dead: string[] = [];
  let sent = 0;

  for (let i = 0; i < tokens.length; i += CHUNK) {
    const messages = tokens.slice(i, i + CHUNK).map((to) => ({ to, title, body, data, sound: "default" }));
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(messages),
    });

    if (!res.ok) {
      console.error("Expo push hatası:", await res.text());
      continue;
    }

    const result = await res.json();
    // DeviceNotRegistered = uygulama silinmiş/token ölmüş. Temizlenmezse bu
    // token'lar sonsuza dek her gönderimde hata üretir.
    (result.data ?? []).forEach((ticket: { status: string; details?: { error?: string } }, index: number) => {
      if (ticket.status === "ok") {
        sent++;
      } else if (ticket.details?.error === "DeviceNotRegistered") {
        dead.push(messages[index].to);
      }
    });
  }

  if (dead.length > 0) {
    await supabase.from("push_tokens").delete().in("expo_push_token", dead);
  }

  return Response.json({ sent, removed: dead.length });
});
