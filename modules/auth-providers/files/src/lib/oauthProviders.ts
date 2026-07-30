import * as AppleAuthentication from "expo-apple-authentication";
import * as Google from "expo-auth-session/providers/google";
import { Platform } from "react-native";
import { isSupabaseConfigured, supabase } from "./supabase";

export const isAppleSignInAvailable = () =>
  Platform.OS === "ios" ? AppleAuthentication.isAvailableAsync() : Promise.resolve(false);

// ÖNEMLİ — anonim oturumdaki veri:
// signInWithIdToken YENİ bir oturum açar; mevcut anonim kullanıcının verisi
// otomatik TAŞINMAZ. İki seçenek var:
//   a) Veri taşınması gerekmiyorsa: olduğu gibi bırak (en basit).
//   b) Taşınması gerekiyorsa: anonim oturum AÇIKKEN
//      `supabase.auth.linkIdentity({ provider: "apple" })` ile kimliği mevcut
//      kullanıcıya BAĞLA — user.id korunur. (Dashboard > Auth > Providers'da
//      "Manual linking" açık olmalı.)
// core/auth'daki e-posta OTP akışı (b) yolunu izliyor (updateUser ile).

export async function signInWithApple(): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured || !supabase) return { error: "Supabase yapılandırılmamış." };

  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    if (!credential.identityToken) {
      return { error: "Apple kimlik doğrulaması tamamlanamadı." };
    }

    const { error } = await supabase.auth.signInWithIdToken({
      provider: "apple",
      token: credential.identityToken,
    });
    return { error: error ? "Giriş yapılamadı. Lütfen tekrar dene." : null };
  } catch (err) {
    // Kullanıcı dialogu kapattıysa hata gösterme.
    if ((err as { code?: string }).code === "ERR_REQUEST_CANCELED") return { error: null };
    console.error("Apple girişi hatası:", err);
    return { error: "Giriş yapılamadı. Lütfen tekrar dene." };
  }
}

// Google native akışı bir hook gerektiriyor (redirect'i AuthSession yönetiyor).
// Kullanım:
//   const { promptAsync, ready } = useGoogleSignIn();
//   <Button disabled={!ready} onPress={() => promptAsync()} />
export function useGoogleSignIn() {
  const [request, , promptAsyncRaw] = Google.useIdTokenAuthRequest({
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    clientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  });

  async function promptAsync(): Promise<{ error: string | null }> {
    if (!isSupabaseConfigured || !supabase) return { error: "Supabase yapılandırılmamış." };

    const result = await promptAsyncRaw();
    if (result.type !== "success") {
      // "dismiss" / "cancel" kullanıcı vazgeçti demek — hata gösterme.
      return { error: result.type === "error" ? "Giriş yapılamadı." : null };
    }

    const idToken = result.params?.id_token;
    if (!idToken) return { error: "Google kimlik doğrulaması tamamlanamadı." };

    const { error } = await supabase.auth.signInWithIdToken({ provider: "google", token: idToken });
    return { error: error ? "Giriş yapılamadı. Lütfen tekrar dene." : null };
  }

  return { promptAsync, ready: Boolean(request) };
}
