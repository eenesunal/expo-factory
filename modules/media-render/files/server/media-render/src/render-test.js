// Deploy etmeden önce çıktıyı gözle kontrol etmek için: her şablon için bir
// PNG ve bir mp4 üretir. Font/ölçüm/wrap hatalarını burada yakalarsın —
// konteynerde font yoksa metin boş kutucuk (tofu) olarak çıkar.
//
// npm run render:test
import { writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { ANIMATED_TEMPLATES } from "./templates.js";
import { renderImage, renderVideo } from "./render.js";

const sample = {
  title: "Örnek Başlık",
  body:
    "Buraya paylaşılacak asıl metin gelir. Uzun bir metnin satırlara doğru bölünüp " +
    "gerektiğinde küçültüldüğünü ve en kötü durumda üç nokta ile kesildiğini " +
    "burada kontrol et. Türkçe karakterler: ğüşıöçĞÜŞİÖÇ.",
  footer: "uygulamaadi.com",
};

for (const templateId of Object.keys(ANIMATED_TEMPLATES)) {
  const png = await renderImage({ templateId, ...sample });
  await writeFile(`test-${templateId}.png`, png);
  // PNG imzası — sharp bir şey döndürdü ama boş/bozuk olmasın.
  assert.equal(png.subarray(1, 4).toString(), "PNG", `${templateId}: geçersiz PNG`);

  const mp4 = await renderVideo({ templateId, ...sample });
  await writeFile(`test-${templateId}.mp4`, mp4);
  assert.ok(mp4.length > 10_000, `${templateId}: mp4 şüpheli derecede küçük (${mp4.length} bayt)`);

  console.log(`✓ ${templateId}: test-${templateId}.png / .mp4`);
}

console.log("\nÜretilen dosyaları GÖZLE kontrol et: metin boş kutucuk (tofu) çıkıyorsa font eksik.");
