// Paylaşım kartının kare kare SVG üreticisi.
//
// Bu dosya sunucudaki tek "tasarım" dosyası — kendi markanla değiştir.
// Uygulamada aynı kartın statik bir React Native önizlemesi de varsa,
// koordinatları/renkleri ikisinde BİREBİR aynı tut; biri değişirse diğeri de
// güncellenmeli (yoksa paylaşılan görsel önizlemeden farklı çıkar).

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import opentype from "opentype.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function toArrayBuffer(buf) {
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

// TUZAK #5 (ikinci yarısı): kaba karakter-sayımı tabanlı word-wrap tahmini
// (fontSize * 0.54 gibi) gerçek font metrikleriyle uyuşmuyor ve satır
// kırılımları önizlemeden farklı çıkıyor. Gerçek .ttf dosyalarını okuyup
// ölçüyoruz.
const displayFont = opentype.parse(
  toArrayBuffer(readFileSync(path.join(__dirname, "../fonts/Fraunces_500Medium.ttf")))
);
const uiFont = opentype.parse(
  toArrayBuffer(readFileSync(path.join(__dirname, "../fonts/Inter_500Medium.ttf")))
);

// font.getAdvanceWidth() gerçek metin şekillendirmesi yapıyor (GSUB: kerning,
// ligature, "ccmp" birleştirme) — Inter'deki bir "ccmp" alt tablosu
// opentype.js'in desteklemediği bir lookup formatı kullandığından her zaman
// çöküyor (features:{liga:false} bile kurtarmıyor, ccmp o bayrakla kapanmıyor).
// Word-wrap için ligature/kerning hassasiyeti gerekmiyor, o yüzden
// şekillendirmeyi atlayıp harf harf gerçek glyph advance-width'lerini
// topluyoruz — hâlâ gerçek font metriği.
function measureWidth(font, text, fontSize) {
  const scale = fontSize / font.unitsPerEm;
  let width = 0;
  for (const ch of text) {
    width += font.charToGlyph(ch).advanceWidth * scale;
  }
  return width;
}

// Kart, viewBox koordinatlarında tasarlanıp FRAME boyutuna ölçekleniyor —
// böylece tasarımı 210x373 gibi "telefon kartı" ölçeğinde düşünebiliyorsun.
export const CARD_W = 210;
export const CARD_H = 373;
// Instagram Story çözünürlüğü. Daha küçük tutmak (640x1138 gibi) telefonda tam
// boy gösterilince gözle görülür şekilde bulanıklaştırıyor.
export const FRAME_W = 1080;
export const FRAME_H = 1920;

const PADDING = 22;
const MAX_TEXT_W = CARD_W - PADDING * 2;

const PALETTES = {
  dark: { bgFrom: "#1B2430", bgTo: "#2C3A4C", ink: "#F3F1EC", accent: "#D9AE6E", muted: "#4A5261" },
  light: { bgFrom: "#FAFAF8", bgTo: "#ECEDE7", ink: "#22252B", accent: "#3A5A9B", muted: "#C9CBC4" },
};

// Metin uzunluğuna göre kademeli başlangıç boyutu.
function startSizeFor(text) {
  if (text.length > 220) return 12;
  if (text.length > 140) return 14;
  if (text.length > 80) return 16;
  return 18;
}

// SVG <text> otomatik sarmaz — elle satırlara bölüyoruz.
function wrapText(font, text, fontSize, maxWidth) {
  const lines = [];
  let current = "";
  for (const word of text.split(/\s+/)) {
    const candidate = current ? `${current} ${word}` : word;
    if (measureWidth(font, candidate, fontSize) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

const LINE_HEIGHT_RATIO = 25 / 18;
const FONT_SIZE_LADDER = [18, 16, 14, 12, 11, 10, 9];
const MAX_LINES = 8;
const TEXT_MAX_HEIGHT = CARD_H - 96 - 26 - 64;

// React Native'in adjustsFontSizeToFit + ellipsizeMode="tail" davranışının
// elle taklidi: küçülen bir boyut merdiveninde ilk sığanı kullan, en küçükte
// bile sığmıyorsa son satırı "…" ile kes.
function fitText(text, maxWidth, maxHeight) {
  const startSize = startSizeFor(text);
  const sizes = FONT_SIZE_LADDER.filter((s) => s <= startSize);
  if (sizes[0] !== startSize) sizes.unshift(startSize);

  let best = null;
  for (const size of sizes) {
    const lineHeight = size * LINE_HEIGHT_RATIO;
    const lines = wrapText(displayFont, text, size, maxWidth);
    best = { size, lineHeight, lines, height: lines.length * lineHeight };
    if (lines.length <= MAX_LINES && best.height <= maxHeight) return best;
  }

  const { size, lineHeight, lines } = best;
  const maxLines = Math.min(lines.length, MAX_LINES, Math.max(1, Math.floor(maxHeight / lineHeight)));
  const truncated = lines.slice(0, maxLines);
  let last = truncated[maxLines - 1];
  while (last.length > 0 && measureWidth(displayFont, `${last}…`, size) > maxWidth) {
    last = last.slice(0, -1).trimEnd();
  }
  truncated[maxLines - 1] = `${last}…`;
  return { size, lineHeight, lines: truncated, height: truncated.length * lineHeight };
}

function fitOneLine(font, text, maxWidth, ladder) {
  for (const size of ladder) {
    if (measureWidth(font, text, size) <= maxWidth) return size;
  }
  return ladder[ladder.length - 1];
}

function escapeXml(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Ease-in-out'a görsel olarak yakın, sürekli bir sinüs eğrisi — CSS
// keyframe'lerin tam kopyası değil ama video kareleri için yeterince yakın bir
// "nefes alma" hissi veriyor.
function breathe(t, period, delay, from, to) {
  const phase = (((t - delay) % period) + period) % period;
  const wave = 0.5 - 0.5 * Math.cos((2 * Math.PI * phase) / period);
  return from + (to - from) * wave;
}

function renderCard({ title, body, footer }, t, palette) {
  const p = PALETTES[palette];
  const { size, lineHeight, lines, height } = fitText(body, MAX_TEXT_W, TEXT_MAX_HEIGHT);

  const titleSize = fitOneLine(uiFont, title, MAX_TEXT_W, [15, 14, 13, 12, 11, 10]);
  const footerSize = fitOneLine(uiFont, footer, MAX_TEXT_W, [11, 10, 9, 8, 7.5, 7]);

  const contentTop = Math.max(70, (CARD_H - height - 60) / 2 + 60);
  const dividerY = Math.max(CARD_H - 44, contentTop + 26 + height + 44);
  const footerY = dividerY + 20;

  // Yavaşça parlayan aksan noktaları — statik bir PNG'de görünmez, videoda
  // kartın "canlı" durmasını sağlar.
  const dots = [
    [CARD_W - 34, 34, 2.2, 3000, 0],
    [CARD_W - 22, 48, 1.4, 2500, 500],
    [CARD_W - 46, 50, 1.2, 3400, 900],
  ]
    .map(
      ([cx, cy, r, period, delay]) =>
        `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${p.accent}" opacity="${breathe(t, period, delay, 0.25, 1).toFixed(2)}" />`
    )
    .join("");

  const bodyLines = lines
    .map((line, i) => `<tspan x="${PADDING}" dy="${i === 0 ? 0 : lineHeight}">${escapeXml(line)}</tspan>`)
    .join("");

  return `
<svg width="${FRAME_W}" height="${FRAME_H}" viewBox="0 0 ${CARD_W} ${CARD_H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0.15" y1="0" x2="0.85" y2="1">
      <stop offset="0" stop-color="${p.bgFrom}" />
      <stop offset="1" stop-color="${p.bgTo}" />
    </linearGradient>
    <clipPath id="cardClip"><rect width="${CARD_W}" height="${CARD_H}" rx="20" /></clipPath>
  </defs>
  <rect width="100%" height="100%" rx="20" fill="url(#bg)" />
  ${dots}
  <g clip-path="url(#cardClip)">
    <text x="${PADDING}" y="52" font-family="Inter Medium, DejaVu Sans, sans-serif" font-size="${titleSize}" letter-spacing="0.4" fill="${p.accent}">${escapeXml(title).toUpperCase()}</text>
    <rect x="${PADDING}" y="${contentTop}" width="30" height="3" rx="1.5" fill="${p.accent}" />
    <text x="${PADDING}" y="${contentTop + 26}" font-family="Fraunces Medium, DejaVu Serif, serif" font-size="${size}" fill="${p.ink}">${bodyLines}</text>
    <line x1="${PADDING}" y1="${dividerY}" x2="${CARD_W - PADDING}" y2="${dividerY}" stroke="${p.muted}" stroke-width="1" />
    <text x="${CARD_W / 2}" y="${footerY}" text-anchor="middle" font-family="Inter Medium, DejaVu Sans, sans-serif" font-size="${footerSize}" fill="${p.accent}">${escapeXml(footer)}</text>
  </g>
</svg>`;
}

export const ANIMATED_TEMPLATES = {
  dark: { render: (params, t) => renderCard(params, t, "dark"), durationMs: 10000 },
  light: { render: (params, t) => renderCard(params, t, "light"), durationMs: 10000 },
};
