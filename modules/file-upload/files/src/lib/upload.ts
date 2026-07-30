import * as ImagePicker from "expo-image-picker";
import { reportError } from "./reportError";
import { isSupabaseConfigured, supabase } from "./supabase";

export type UploadResult =
  | { path: string; publicUrl: string; error: null }
  // Kullanıcı vazgeçtiyse ikisi de null döner (hata değil).
  | { path: null; publicUrl: null; error: string | null };

// ponytail: sıkıştırma için ImagePicker'ın kendi `quality` seçeneği kullanılıyor,
// ayrı bir expo-image-manipulator bağımlılığı YOK. Ceiling: piksel boyutunu
// (maks. genişlik/yükseklik) zorlayamıyor, sadece JPEG kalitesini düşürüyor.
// Yükseltme yolu: gerçekten maks. çözünürlük şartın varsa
// `npx expo install expo-image-manipulator` kurup seçilen asset'i resize et.
const QUALITY = 0.7;

// Yol MUTLAKA "<user_id>/..." ile başlamalı — Storage RLS politikaları ilk
// klasör adının kullanıcı id'si olmasına dayanıyor (bkz. schema.sql).
export async function pickAndUploadImage(options?: {
  bucket?: string;
  fileName?: string;
  fromCamera?: boolean;
}): Promise<UploadResult> {
  const bucket = options?.bucket ?? "avatars";
  const empty = { path: null, publicUrl: null } as const;

  if (!isSupabaseConfigured || !supabase) {
    return { ...empty, error: "Supabase yapılandırılmamış." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ...empty, error: "Oturum gerekli." };

  const permission = options?.fromCamera
    ? await ImagePicker.requestCameraPermissionsAsync()
    : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (permission.status !== "granted") {
    return { ...empty, error: "İzin verilmedi." };
  }

  const pickerOptions: ImagePicker.ImagePickerOptions = {
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: [1, 1],
    quality: QUALITY,
  };
  const result = options?.fromCamera
    ? await ImagePicker.launchCameraAsync(pickerOptions)
    : await ImagePicker.launchImageLibraryAsync(pickerOptions);

  if (result.canceled || result.assets.length === 0) return { ...empty, error: null };

  const asset = result.assets[0];
  const extension = (asset.uri.split(".").pop() ?? "jpg").toLowerCase().split("?")[0];
  const fileName = options?.fileName ?? `${Date.now()}.${extension}`;
  const path = `${user.id}/${fileName}`;

  // React Native'de Blob desteği eksik/güvenilmez — Supabase'in RN için
  // önerdiği yol dosyayı fetch edip ArrayBuffer olarak yüklemek.
  const arrayBuffer = await fetch(asset.uri).then((res) => res.arrayBuffer());

  const { error } = await supabase.storage.from(bucket).upload(path, arrayBuffer, {
    contentType: asset.mimeType ?? `image/${extension === "jpg" ? "jpeg" : extension}`,
    upsert: true,
  });
  if (error) {
    reportError("Yükleme hatası", error);
    return { ...empty, error: "Dosya yüklenemedi. Lütfen tekrar dene." };
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return { path, publicUrl: data.publicUrl, error: null };
}

// Profildeki avatar yolunu günceller (tam URL değil path saklıyoruz — bucket'ı
// private'a çevirirsen URL'ler değişir, path aynı kalır).
export async function setMyAvatarPath(path: string): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured || !supabase) return { error: "Supabase yapılandırılmamış." };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum gerekli." };

  const { error } = await supabase.from("profiles").update({ avatar_path: path }).eq("id", user.id);
  return { error: error ? "Profil güncellenemedi." : null };
}

export function publicUrlFor(path: string, bucket = "avatars"): string | null {
  if (!supabase) return null;
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}
