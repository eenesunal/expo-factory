import express from "express";
import { ANIMATED_TEMPLATES } from "./templates.js";
import { renderImage, renderVideo } from "./render.js";

const app = express();
const PORT = process.env.PORT || 8787;
const AUTH_TOKEN = process.env.MEDIA_RENDER_TOKEN;

const MAX_TITLE = 80;
const MAX_BODY = 600;
const MAX_FOOTER = 60;

// ponytail: POST + JSON body yerine GET + query string — mobil tarafta binary
// indirme için expo-file-system'in downloadFileAsync'i sadece GET URL alıyor,
// ayrıca bir ArrayBuffer->base64 dönüşümü yazmaya gerek kalmıyor.
function parseParams(req) {
  const { templateId, title, body, footer } = req.query ?? {};
  if (!ANIMATED_TEMPLATES[templateId]) return { error: "Geçersiz şablon" };
  if (typeof body !== "string" || !body.trim()) return { error: "body gerekli" };
  if (body.length > MAX_BODY) return { error: `body en fazla ${MAX_BODY} karakter` };
  const safeTitle = typeof title === "string" ? title.slice(0, MAX_TITLE) : "";
  const safeFooter = typeof footer === "string" ? footer.slice(0, MAX_FOOTER) : "";
  return { params: { templateId, title: safeTitle, body, footer: safeFooter } };
}

function authorized(req) {
  return !AUTH_TOKEN || req.headers.authorization === `Bearer ${AUTH_TOKEN}`;
}

app.get("/render.mp4", async (req, res) => {
  if (!authorized(req)) return res.status(401).json({ error: "Yetkilendirme gerekli" });
  const { params, error } = parseParams(req);
  if (error) return res.status(400).json({ error });

  try {
    const video = await renderVideo(params);
    res.setHeader("Content-Type", "video/mp4");
    res.send(video);
  } catch (err) {
    console.error("Video render hatası:", err);
    res.status(500).json({ error: "Video oluşturulamadı" });
  }
});

app.get("/render.png", async (req, res) => {
  if (!authorized(req)) return res.status(401).json({ error: "Yetkilendirme gerekli" });
  const { params, error } = parseParams(req);
  if (error) return res.status(400).json({ error });

  try {
    const png = await renderImage(params);
    res.setHeader("Content-Type", "image/png");
    res.send(png);
  } catch (err) {
    console.error("Görsel render hatası:", err);
    res.status(500).json({ error: "Görsel oluşturulamadı" });
  }
});

app.get("/health", (_req, res) => res.json({ ok: true, templates: Object.keys(ANIMATED_TEMPLATES) }));

app.listen(PORT, () => console.log(`media-render servisi ${PORT} portunda çalışıyor`));
