#!/usr/bin/env node
// Belgeleri embedding'leriyle birlikte rag_documents tablosuna yükler.
//
// Kullanım:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... OPENAI_API_KEY=... \
//   node scripts/embed-documents.mjs documents.json
//
// Girdi formatı: scripts/documents.example.json
// Tekrar çalıştırmak güvenli — entity_id üzerinden upsert eder.

import { readFileSync } from "node:fs";

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const file = process.argv[2];
if (!file || !SUPABASE_URL || !SERVICE_ROLE_KEY || !OPENAI_API_KEY) {
  console.error(
    "Kullanım: node scripts/embed-documents.mjs <documents.json>\n" +
      "Gerekli env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY"
  );
  process.exit(1);
}

const documents = JSON.parse(readFileSync(file, "utf8"));
if (!Array.isArray(documents) || documents.length === 0) {
  console.error("Girdi boş bir dizi olmayan bir JSON dizisi olmalı.");
  process.exit(1);
}

for (const [i, doc] of documents.entries()) {
  if (!doc.entity_id || !doc.reference_label || !doc.content) {
    console.error(`Kayıt ${i}: entity_id, reference_label ve content zorunlu.`);
    process.exit(1);
  }
}

// OpenAI embeddings API tek istekte birden fazla input alıyor — 100'lük
// gruplar hem rate limit'e hem de istek boyutuna rahat sığıyor.
const BATCH = 100;

async function embedBatch(texts) {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({ model: "text-embedding-3-small", input: texts }),
  });
  if (!res.ok) throw new Error(`OpenAI hatası: ${await res.text()}`);
  const data = await res.json();
  return data.data.map((d) => d.embedding);
}

async function upsert(rows) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rag_documents?on_conflict=entity_id`, {
    method: "POST",
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error(`Supabase upsert hatası: ${await res.text()}`);
}

let done = 0;
for (let i = 0; i < documents.length; i += BATCH) {
  const chunk = documents.slice(i, i + BATCH);
  const embeddings = await embedBatch(chunk.map((d) => d.content));
  await upsert(
    chunk.map((d, j) => ({
      entity_id: d.entity_id,
      category: d.category ?? null,
      reference_label: d.reference_label,
      content: d.content,
      sort_key: d.sort_key ?? null,
      embedding: embeddings[j],
    }))
  );
  done += chunk.length;
  console.log(`${done}/${documents.length}`);
}

console.log(
  "\nBitti. ŞİMDİ HNSW index'ini oluştur (boş tabloda oluşturulmuş olabilir):\n" +
    "  create index if not exists rag_documents_embedding_idx\n" +
    "    on rag_documents using hnsw (embedding vector_cosine_ops);"
);
