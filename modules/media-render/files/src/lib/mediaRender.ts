import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

// Sunucu tarafı render servisi (bkz. server/media-render). react-native-view-shot
// native tarafta sadece STATİK PNG yakalayabildiği için animasyonlu paylaşım
// (mp4) sunucuda üretilir.
const SERVICE_URL = process.env.EXPO_PUBLIC_MEDIA_RENDER_URL;
const TOKEN = process.env.EXPO_PUBLIC_MEDIA_RENDER_TOKEN;

// Servis kurulmadıysa paylaşım butonunu hiç göstermemek için.
export const isMediaRenderConfigured = Boolean(SERVICE_URL);

export type CardParams = {
  templateId: "dark" | "light";
  title: string;
  body: string;
  footer: string;
};

async function download(kind: "mp4" | "png", params: CardParams): Promise<string> {
  if (!SERVICE_URL) throw new Error("Render servisi yapılandırılmamış.");

  const query = new URLSearchParams(params).toString();
  const destination = new File(Paths.cache, `share-${Date.now()}.${kind}`);
  const file = await File.downloadFileAsync(`${SERVICE_URL}/render.${kind}?${query}`, destination, {
    headers: TOKEN ? { Authorization: `Bearer ${TOKEN}` } : undefined,
  });
  return file.uri;
}

export function renderCardVideo(params: CardParams): Promise<string> {
  return download("mp4", params);
}

export function renderCardImage(params: CardParams): Promise<string> {
  return download("png", params);
}

// Instagram Stories/Feed bir GIF'i yüklerken statik hale çeviriyor — animasyonlu
// paylaşım için mp4 şart.
export async function shareCard(kind: "mp4" | "png", params: CardParams): Promise<void> {
  const uri = await download(kind, params);
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error("Bu cihazda paylaşım kullanılamıyor.");
  }
  await Sharing.shareAsync(uri, {
    mimeType: kind === "mp4" ? "video/mp4" : "image/png",
    dialogTitle: params.title,
  });
}
