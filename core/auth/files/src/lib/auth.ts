import { isSupabaseConfigured, supabase } from "./supabase";

// Supabase'in İngilizce hata mesajlarını kullanıcıya gösterilecek Türkçe
// karşılıklarına çevirir. Ham mesajı ASLA kullanıcıya göstermiyoruz ama
// console.error ile logluyoruz — eşleşmeyen yeni bir hata deseni çıkınca
// cihaz/Metro loglarından görülüp buraya eklenebilsin.
function translateAuthError(message: string | null | undefined): string {
  console.error("Auth hatası (ham):", message);
  const msg = (message ?? "").toLowerCase();
  if (msg.includes("already been registered") || msg.includes("already registered")) {
    return "Bu e-posta adresi zaten kayıtlı. Giriş yapmak için gönderilen kodu kullan.";
  }
  // Supabase "Token has expired or is invalid" mesajını hem gerçek süre
  // dolumunda hem de yanlış/eski kod girildiğinde aynı şekilde döner —
  // ikisini ayırt edemiyoruz, mesaj her iki ihtimali de kapsıyor.
  if (msg.includes("token has expired") || msg.includes("otp expired")) {
    return "Kod hatalı ya da süresi dolmuş. E-postana gelen SON kodu kullandığından emin ol, ya da yeni bir kod iste.";
  }
  if (msg.includes("invalid") && (msg.includes("otp") || msg.includes("token"))) {
    return "Girdiğin kod hatalı. E-postana gelen son kodu kontrol edip tekrar dene.";
  }
  if (msg.includes("for security purposes") || msg.includes("rate limit")) {
    return "Çok sık denedin. Lütfen biraz sonra tekrar dene.";
  }
  if (msg.includes("unable to validate email") || msg.includes("invalid email")) {
    return "Geçerli bir e-posta adresi gir.";
  }
  if (msg.includes("error sending") && msg.includes("email")) {
    return "E-posta gönderilemedi. Lütfen birkaç dakika sonra tekrar dene.";
  }
  return "Bir sorun oluştu. Lütfen tekrar dene.";
}

// Kullanıcı hiçbir şey yapmadan (login ekranı olmadan) cihaz bazlı bir kimlik
// oluşturur; kullanım/limit takibi bu kimliğe göre yapılır. İstenirse ileride
// gerçek bir hesaba yükseltilebilir (startEmailAuth/confirmEmailAuth).
//
// DİKKAT: App.tsx bunu ÇAĞIRIRKEN `.catch()` + timeout ile sarmalı — ağ hatası
// ya da askıda kalan bir istek uygulamayı sonsuza dek splash'ta bırakır.
export async function ensureSession() {
  if (!isSupabaseConfigured || !supabase) return null;

  const { data } = await supabase.auth.getSession();
  if (data.session) return data.session;

  const { data: signInData, error } = await supabase.auth.signInAnonymously();
  if (error) {
    console.error("Anonim oturum açılamadı:", error.message);
    return null;
  }
  return signInData.session;
}

export async function getLinkedEmail(): Promise<string | null> {
  if (!isSupabaseConfigured || !supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user?.email ?? null;
}

export async function getCurrentUserId(): Promise<string | null> {
  if (!isSupabaseConfigured || !supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

// Anonim oturumu aynı user id'yi koruyarak bir e-postaya bağlar. Supabase bu
// e-postaya doğrulama kodu gönderir (Dashboard > Auth > Email Templates >
// "Change Email Address" şablonunda {{ .Token }} olmalı ki link yerine 6
// haneli kod gitsin).
export async function linkEmail(email: string) {
  if (!isSupabaseConfigured || !supabase) return { error: "Supabase yapılandırılmamış." };
  const { error } = await supabase.auth.updateUser({ email });
  return { error: error ? translateAuthError(error.message) : null };
}

export type StartAuthMode = "login" | "signup";

// shouldCreateUser:false ile signInWithOtp, email kayıtlı değilse Supabase'in
// kendi "signups not allowed" hatasını döner — bunu "kayıtlı değil, signup'a
// düş" sinyali olarak kullanıyoruz. BAŞKA herhangi bir hata (rate limit vb.)
// signup akışına düşülmeden doğrudan gösterilir; aksi halde o email zaten
// kayıtlıysa linkEmail "already registered" ile patlar ve kullanıcı gerçek
// hata yerine yanlışlıkla "zaten kayıtlısın" görür.
function looksLikeNotRegistered(message: string | undefined): boolean {
  const msg = (message ?? "").toLowerCase();
  return msg.includes("signups not allowed") || msg.includes("signup is disabled");
}

// App Store review notu: reviewer gerçek e-postaya gelen OTP'yi göremez.
// Admin API ile sabit şifreli bir review hesabı oluşturup burada bypass
// ekleyebilirsin (App Review notlarında Apple'a bildir):
//
//   const REVIEW_EMAIL = "appreview@ornek.com";
//   const REVIEW_CODE = "482917";
//   const REVIEW_PASSWORD = "<sadece bu hesapta bilinen şifre>";
//   // startEmailAuth: email === REVIEW_EMAIL ise OTP gönderme, {mode:"login"} dön
//   // confirmEmailAuth: token === REVIEW_CODE ise signInWithPassword ile gir

export async function startEmailAuth(
  email: string
): Promise<{ mode: StartAuthMode; error: string | null }> {
  if (!isSupabaseConfigured || !supabase) {
    return { mode: "signup", error: "Supabase yapılandırılmamış." };
  }

  const { error: loginError } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false },
  });

  if (!loginError) return { mode: "login", error: null };

  if (!looksLikeNotRegistered(loginError.message)) {
    return { mode: "login", error: translateAuthError(loginError.message) };
  }

  const { error: signupError } = await linkEmail(email);
  return { mode: "signup", error: signupError };
}

// startEmailAuth'un döndüğü mode'a göre doğru verifyOtp tipini seçer.
export async function confirmEmailAuth(mode: StartAuthMode, email: string, token: string) {
  if (!isSupabaseConfigured || !supabase) return { error: "Supabase yapılandırılmamış." };

  const { error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: mode === "login" ? "email" : "email_change",
  });
  return { error: error ? translateAuthError(error.message) : null };
}

// Hesabı kalıcı olarak siler (delete-account edge function service-role ile
// auth.users'ı siler — "on delete cascade" olan tablolar otomatik temizlenir).
// Apple Guideline 5.1.1(v) bunu zorunlu kılıyor.
export async function deleteAccount(): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured || !supabase) return { error: "Supabase yapılandırılmamış." };
  const { error } = await supabase.functions.invoke("delete-account");
  if (error) return { error: translateAuthError(error.message) };
  await supabase.auth.signOut();
  return { error: null };
}
