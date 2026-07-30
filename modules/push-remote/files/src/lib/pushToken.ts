import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { isSupabaseConfigured, supabase } from "./supabase";

// Oturum kurulduktan SONRA, uygulama açılışında çağır. Token cihaz/kurulum
// başına değişir — her açılışta upsert etmek en güvenlisi.
export async function registerPushToken(): Promise<{ token: string | null; error: string | null }> {
  if (!isSupabaseConfigured || !supabase) return { token: null, error: "Supabase yapılandırılmamış." };
  // Simülatör/emülatörde push token alınamaz — hata değil, sessizce çık.
  if (!Device.isDevice) return { token: null, error: null };

  const existing = await Notifications.getPermissionsAsync();
  const status =
    existing.status === "granted"
      ? existing.status
      : (await Notifications.requestPermissionsAsync()).status;
  if (status !== "granted") return { token: null, error: null };

  if (Platform.OS === "android") {
    // Android 8+ kanal olmadan bildirim göstermiyor.
    await Notifications.setNotificationChannelAsync("default", {
      name: "Genel",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  // projectId ZORUNLU (`eas init` app.json'a yazar) — yoksa
  // getExpoPushTokenAsync anlaşılmaz bir hatayla patlar.
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) {
    return { token: null, error: "EAS projectId yok — `eas init` çalıştır." };
  }

  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { token, error: "Oturum gerekli." };

  const { error } = await supabase
    .from("push_tokens")
    .upsert(
      { user_id: user.id, expo_push_token: token, platform: Platform.OS, updated_at: new Date().toISOString() },
      { onConflict: "expo_push_token" }
    );

  return { token, error: error ? "Push token kaydedilemedi." : null };
}

// Çıkış yaparken çağır — yoksa bir sonraki kullanıcı önceki hesabın
// bildirimlerini alır.
export async function unregisterPushToken(): Promise<void> {
  if (!isSupabaseConfigured || !supabase || !Device.isDevice) return;
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return;
  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await supabase.from("push_tokens").delete().eq("expo_push_token", token);
  } catch (err) {
    console.error("Push token silinemedi:", err);
  }
}
