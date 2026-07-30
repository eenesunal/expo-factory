import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import ffmpegPath from "ffmpeg-static";
import sharp from "sharp";
import { ANIMATED_TEMPLATES, FRAME_W, FRAME_H } from "./templates.js";

const execFileAsync = promisify(execFile);

// ponytail: 12fps@1080x1920@10s küçük bir konteynerde tutarlı biçimde
// başarısız oluyordu. Yavaş "nefes alma" animasyonlarında 8fps görsel olarak
// ayırt edilemez ve kare sayısını (dolayısıyla render yükünü) 1/3 azaltır.
const FPS = 8;

// Bir şablonu verilen içerikle kare kare SVG->PNG'ye çevirip mp4'e encode eder.
export async function renderVideo({ templateId, title, body, footer }) {
  const template = ANIMATED_TEMPLATES[templateId];
  if (!template) throw new Error(`Bilinmeyen şablon: ${templateId}`);

  const frameCount = Math.round((template.durationMs / 1000) * FPS);
  const dir = await mkdtemp(join(tmpdir(), "media-render-"));

  try {
    for (let i = 0; i < frameCount; i++) {
      const svg = template.render({ title, body, footer }, (i / FPS) * 1000);
      const png = await sharp(Buffer.from(svg)).png().toBuffer();
      await writeFile(join(dir, `frame-${String(i).padStart(4, "0")}.png`), png);
    }

    const outputPath = join(dir, "output.mp4");
    await execFileAsync(
      ffmpegPath,
      [
        "-y",
        // TUZAK: ffmpeg'in varsayılan per-frame ilerleme çıktısı ("frame=... fps=...")
        // stderr'e akıyor ve Node'un execFile'daki varsayılan 1MB maxBuffer'ını
        // aşıp süreci SIGTERM ile öldürüyor. Bu, "ara sıra render patlıyor"
        // şikayetinin gerçek sebebiydi.
        "-loglevel", "error",
        "-framerate", String(FPS),
        "-i", join(dir, "frame-%04d.png"),
        "-vf", `scale=${FRAME_W}:${FRAME_H}`,
        "-c:v", "libx264",
        // TUZAK #4 — BU SATIRI KALDIRMA. libx264 konteynerin gördüğü (yanıltıcı
        // yüksek) CPU sayısına göre "threads=60" gibi bir değer seçip kare 0'da
        // bile OOM'dan SIGKILL yiyor. Belleğe göre elle sınırlıyoruz.
        "-threads", "2",
        "-crf", "18",
        "-pix_fmt", "yuv420p",
        "-movflags", "+faststart",
        outputPath,
      ],
      // -loglevel error çıktıyı neredeyse sıfıra indiriyor ama gerçek bir hata
      // mesajı yine de kesilmesin diye maxBuffer'ı cömertçe büyütüyoruz.
      { maxBuffer: 16 * 1024 * 1024 }
    );

    return await readFile(outputPath);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

// Statik paylaşım görseli — video'ya göre çok daha hızlı ve ucuz. Animasyona
// ihtiyacın yoksa client'tan sadece bunu çağır.
export async function renderImage({ templateId, title, body, footer }) {
  const template = ANIMATED_TEMPLATES[templateId];
  if (!template) throw new Error(`Bilinmeyen şablon: ${templateId}`);
  const svg = template.render({ title, body, footer }, 0);
  return sharp(Buffer.from(svg)).png().toBuffer();
}
