#!/usr/bin/env node
// .env içindeki her EXPO_PUBLIC_* değişkenini EAS'ın environment store'una
// yükler.
//
// NEDEN GEREKLİ: EAS Build yerel `.env` dosyasını GÖRMEZ — `.env` gitignore'da
// olduğu için cloud build'e hiç yüklenmiyor. Bu adım atlanırsa production
// build'de TÜM `EXPO_PUBLIC_*` değişkenleri undefined olur, uygulama backend'e
// hiç bağlanamaz ve bu ancak gerçek cihazda fark edilir.
//
// Kullanım: node scripts/setup-eas-env.mjs [production|preview|development]

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const environment = process.argv[2] ?? "production";
if (!["production", "preview", "development"].includes(environment)) {
  console.error(`Geçersiz environment: ${environment} (production | preview | development)`);
  process.exit(1);
}

let raw;
try {
  raw = readFileSync(".env", "utf8");
} catch {
  console.error(".env bulunamadı. .env.example'ı kopyalayıp doldur.");
  process.exit(1);
}

// ponytail: dotenv yerine düz parse — `KEY=value` satırları, tırnak varsa soyar.
// Ceiling: çok satırlı değer desteklemiyor. Gerekirse dotenv kur.
const entries = raw
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith("#") && line.includes("="))
  .map((line) => {
    const eq = line.indexOf("=");
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim().replace(/^["'](.*)["']$/, "$1");
    return [key, value];
  })
  .filter(([key, value]) => key.startsWith("EXPO_PUBLIC_") && value);

if (entries.length === 0) {
  console.error(".env içinde dolu bir EXPO_PUBLIC_* değişkeni yok.");
  process.exit(1);
}

console.log(`${entries.length} değişken "${environment}" environment'ına yazılıyor...\n`);

let failed = 0;
for (const [name, value] of entries) {
  // EXPO_PUBLIC_* değerleri zaten uygulama binary'sine gömülüyor — plaintext
  // doğru görünürlük. Sunucu tarafı sırları (SERVICE_ROLE_KEY, API key'ler)
  // buraya DEĞİL, `supabase secrets set` ile edge function'lara koy.
  const args = [
    "env:create",
    "--environment", environment,
    "--name", name,
    "--value", value,
    "--visibility", "plaintext",
    "--scope", "project",
    "--non-interactive",
    "--force",
  ];
  const result = spawnSync("eas", args, { stdio: "inherit", shell: process.platform === "win32" });
  if (result.status !== 0) {
    failed++;
    console.error(`  ✗ ${name}`);
  } else {
    console.log(`  ✓ ${name}`);
  }
}

console.log(
  `\n${entries.length - failed}/${entries.length} yazıldı. Kontrol: eas env:list --environment ${environment}`
);
if (failed > 0) {
  console.error(
    "\nBaşarısız olanlar için: `eas login` yaptın mı, `eas init` ile projectId oluştu mu?"
  );
  process.exit(1);
}
console.log(
  `\nSON ADIM: eas.json'daki build profilinde "environment": "${environment}" satırı olmalı — yoksa bu değişkenler build'e enjekte edilmez.`
);
