#!/usr/bin/env node
// expo-factory kurulum aracı: birkaç soru sorar, sadece seçilen modülleri
// hedef klasöre kopyalar, package.json / app.json / schema.sql / .env.example
// parçalarını birleştirir ve sonunda elle yapılması gereken adımların
// listesini (SETUP.md) üretir.
//
// Kullanım: node create.mjs [hedef-klasör]

import { cp, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import prompts from "prompts";

const ROOT = dirname(fileURLToPath(import.meta.url));

// Placeholder değişimi sadece bu uzantılarda yapılır — fonts/*.ttf gibi
// binary dosyalar metin olarak okunup bozulmasın.
const TEXT_EXT = new Set([
  ".json", ".html", ".md", ".ts", ".tsx", ".sql", ".mjs", ".js",
  ".txt", ".yml", ".yaml", ".xml", ".env", ".example", "",
]);

// ---------------------------------------------------------------- manifestler

export async function loadUnits(root = ROOT) {
  const units = new Map();
  for (const [base, isCore] of [["core", true], ["modules", false]]) {
    const dir = join(root, base);
    if (!existsSync(dir)) continue;
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const unitDir = join(dir, entry.name);
      const manifestPath = join(unitDir, "manifest.json");
      if (!existsSync(manifestPath)) continue;
      const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
      if (manifest.name !== entry.name) {
        throw new Error(`${manifestPath}: manifest.name ("${manifest.name}") klasör adıyla ("${entry.name}") aynı olmalı`);
      }
      units.set(manifest.name, { ...manifest, isCore, dir: unitDir });
    }
  }
  return units;
}

// Seçilen modülleri dependsOn'larıyla birlikte, bağımlılıklar önce gelecek
// şekilde sıralar. core birimleri her zaman ve modüllerden önce gelir.
// Dönen `added`: kullanıcının seçmediği ama bir bağımlılık olarak eklenen
// modüller — ekranda bildirmek için.
export function resolveSelection(units, chosen) {
  const ordered = [];
  const done = new Set();
  const stack = new Set();
  const added = [];

  function visit(name, requiredBy) {
    if (done.has(name)) return;
    if (stack.has(name)) {
      throw new Error(`Modül bağımlılıklarında döngü: ${[...stack, name].join(" -> ")}`);
    }
    const unit = units.get(name);
    if (!unit) throw new Error(`Bilinmeyen modül: ${name}${requiredBy ? ` (${requiredBy} bunu istiyor)` : ""}`);
    stack.add(name);
    for (const dep of unit.dependsOn ?? []) visit(dep, name);
    stack.delete(name);
    done.add(name);
    ordered.push(unit);
    if (requiredBy && !chosen.includes(name)) added.push({ name, requiredBy });
  }

  for (const unit of [...units.values()].filter((u) => u.isCore)) visit(unit.name, null);
  for (const name of chosen) visit(name, null);

  return { ordered, added };
}

// ------------------------------------------------------------------ yardımcı

export function applyVars(text, vars) {
  return text.replace(/__([A-Z0-9_]+)__/g, (match, key) => (key in vars ? vars[key] : match));
}

// Objeleri derin birleştirir, dizileri birleştirir (app.json plugins gibi).
export function mergeInto(target, patch) {
  for (const [key, value] of Object.entries(patch)) {
    if (Array.isArray(value)) {
      target[key] = [...(Array.isArray(target[key]) ? target[key] : []), ...value];
    } else if (value && typeof value === "object") {
      if (!target[key] || typeof target[key] !== "object") target[key] = {};
      mergeInto(target[key], value);
    } else {
      target[key] = value;
    }
  }
  return target;
}

// "expo-camera@~57.0.0" -> ["expo-camera", "~57.0.0"]
// "@expo/vector-icons@^15.0.2" -> ["@expo/vector-icons", "^15.0.2"]
export function parseDep(spec) {
  const at = spec.lastIndexOf("@");
  if (at <= 0) return [spec, "latest"];
  return [spec.slice(0, at), spec.slice(at + 1)];
}

async function substituteTree(dir, vars) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".git") continue;
      await substituteTree(path, vars);
      continue;
    }
    if (!TEXT_EXT.has(extname(entry.name))) continue;
    const before = await readFile(path, "utf8");
    const after = applyVars(before, vars);
    if (after !== before) await writeFile(path, after, "utf8");
  }
}

async function readIfExists(path) {
  return existsSync(path) ? await readFile(path, "utf8") : null;
}

// ------------------------------------------------------------------ üretim

export async function generate({ target, ordered, vars }) {
  await mkdir(target, { recursive: true });

  // 1) dosyalar
  for (const unit of ordered) {
    const src = join(unit.dir, "files");
    if (!existsSync(src)) continue;
    for (const rel of unit.filesToCopy ?? ["."]) {
      const from = join(src, rel);
      if (!existsSync(from)) throw new Error(`${unit.name}: filesToCopy içinde olmayan yol: ${rel}`);
      await cp(from, rel === "." ? target : join(target, rel), { recursive: true, force: true });
    }
  }

  await substituteTree(target, vars);

  // 2) package.json bağımlılıkları
  const pkgPath = join(target, "package.json");
  const pkg = JSON.parse(await readFile(pkgPath, "utf8"));
  for (const unit of ordered) {
    for (const spec of unit.packageDependencies ?? []) {
      const [name, version] = parseDep(spec);
      pkg.dependencies[name] = version;
    }
  }
  pkg.dependencies = Object.fromEntries(Object.entries(pkg.dependencies).sort(([a], [b]) => a.localeCompare(b)));
  await writeFile(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf8");

  // 3) app.json (expo.plugins / permissions / scheme ...)
  const appJsonPath = join(target, "app.json");
  const appJson = JSON.parse(await readFile(appJsonPath, "utf8"));
  for (const unit of ordered) {
    if (unit.appJson) mergeInto(appJson.expo, JSON.parse(applyVars(JSON.stringify(unit.appJson), vars)));
  }
  await writeFile(appJsonPath, JSON.stringify(appJson, null, 2) + "\n", "utf8");

  // 4) tek bir schema.sql
  const schemaParts = [
    `-- ${vars.APP_NAME} — birleşik Supabase şeması (expo-factory tarafından üretildi)`,
    "-- Supabase Dashboard > SQL Editor içinde baştan sona çalıştır.",
    "-- Idempotent: tekrar çalıştırmak güvenli.",
  ];
  for (const unit of ordered) {
    const sql = await readIfExists(join(unit.dir, unit.schemaFragment ?? "schema.sql"));
    if (!sql) continue;
    schemaParts.push(`\n-- ${"=".repeat(72)}\n-- ${unit.name}\n-- ${"=".repeat(72)}\n`, applyVars(sql.trim(), vars));
  }
  await mkdir(join(target, "supabase"), { recursive: true });
  await writeFile(join(target, "supabase", "schema.sql"), schemaParts.join("\n") + "\n", "utf8");

  // 5) .env.example
  const envParts = [
    "# expo-factory tarafından üretildi. Bu dosyayı .env olarak kopyalayıp doldur.",
    "#",
    "# ÖNEMLİ: EAS Build bu dosyayı GÖRMEZ (.env gitignore'da). Her EXPO_PUBLIC_*",
    "# değişkeni ayrıca `eas env:create` ile EAS'a kaydedilmeli — bkz. SETUP.md.",
  ];
  for (const unit of ordered) {
    const vars_ = unit.envVars ?? [];
    if (vars_.length === 0) continue;
    envParts.push(`\n# --- ${unit.name} ---`);
    for (const name of vars_) envParts.push(`${name}=`);
  }
  await writeFile(join(target, ".env.example"), envParts.join("\n") + "\n", "utf8");

  // 6) navigasyon ekranlarını App.tsx + navigation.ts'e enjekte et
  const screens = ordered.flatMap((u) => u.navigationScreens ?? []);
  const appTsxPath = join(target, "App.tsx");
  const appTsx = await readFile(appTsxPath, "utf8");
  await writeFile(
    appTsxPath,
    appTsx
      .replace(
        "// @factory:imports",
        screens.map((s) => `import { ${s.component} } from "${s.importPath}";`).join("\n") || "// (modül ekranı yok)"
      )
      .replace(
        "{/* @factory:screens */}",
        screens
          .map((s) => `<Stack.Screen name="${s.name}" component={${s.component}} />`)
          .join("\n            ") || "{/* modül ekranı yok */}"
      ),
    "utf8"
  );

  const navPath = join(target, "src", "lib", "navigation.ts");
  const nav = await readFile(navPath, "utf8");
  await writeFile(
    navPath,
    nav.replace(
      "  // @factory:routes",
      screens.map((s) => `  ${s.name}: ${s.params ?? "undefined"};`).join("\n") || "  // (modül rotası yok)"
    ),
    "utf8"
  );

  // 7) SETUP.md
  const always = [
    "Supabase projesi oluştur ve `supabase/schema.sql`'i SQL Editor'de baştan sona çalıştır.",
    "`.env.example`'ı `.env` olarak kopyalayıp yerel geliştirme için doldur.",
    "HER `EXPO_PUBLIC_*` değişkenini EAS'a kaydet: `node scripts/setup-eas-env.mjs production` (EAS Build yerel `.env`'i GÖRMEZ — atlanırsa production build'de tüm env değişkenleri undefined olur).",
    "`eas.json`'daki kullandığın build profiline `\"environment\": \"production\"` (veya preview/development) satırının durduğunu doğrula.",
    "`app.json`: `name` alanı Xcode target adıyla eşleşmeli (uyuşmazsa EAS build \"Could not find target\" ile patlar). Kullanıcıya görünen ad için `ios.infoPlist.CFBundleDisplayName` kullan.",
    "`assets/` içindeki ikon ve splash görsellerini kendi tasarımlarınla değiştir.",
    "Supabase Dashboard > Auth > Email Templates: \"Magic Link\" ve \"Change Email Address\" şablonlarında `{{ .Token }}` kullan (link değil 6 haneli kod gitsin).",
    "Edge function'ları deploy et: `supabase functions deploy <isim>` (liste için `supabase/functions/` klasörüne bak).",
  ];
  const perUnit = ordered
    .filter((u) => (u.setupSteps ?? []).length > 0)
    .map((u) => `### ${u.name}\n\n${u.setupSteps.map((s, i) => `${i + 1}. ${s}`).join("\n")}`);

  const setup = [
    `# ${vars.APP_NAME} — kurulum checklist'i`,
    "",
    `Kurulan modüller: ${ordered.map((u) => u.name).join(", ")}`,
    "",
    "## Her zaman",
    "",
    ...always.map((s, i) => `${i + 1}. ${s}`),
    "",
    "## Modüle özel",
    "",
    ...(perUnit.length > 0 ? perUnit : ["(seçilen modüllerin ek adımı yok)"]),
    "",
  ].join("\n");
  await writeFile(join(target, "SETUP.md"), setup + "\n", "utf8");

  return { setup, screens };
}

// -------------------------------------------------------------------- CLI

async function main() {
  const units = await loadUnits();
  const modules = [...units.values()].filter((u) => !u.isCore).sort((a, b) => a.name.localeCompare(b.name));

  const answers = await prompts(
    [
      {
        type: "text",
        name: "appName",
        message: "Uygulama adı (kullanıcıya görünen)",
        validate: (v) => (v.trim().length > 0 ? true : "Boş olamaz"),
      },
      {
        type: "text",
        name: "slug",
        message: "Slug (klasör/paket adı, küçük harf-tire)",
        initial: (prev) => prev.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
        validate: (v) => (/^[a-z0-9-]+$/.test(v) ? true : "Sadece küçük harf, rakam ve tire"),
      },
      {
        type: "text",
        name: "bundleId",
        message: "Bundle identifier / Android package",
        initial: (prev) => `com.example.${prev.replace(/-/g, "")}`,
        validate: (v) => (/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(v) ? true : "örn. com.sirket.uygulama"),
      },
      {
        type: "text",
        name: "domain",
        message: "Tanıtım sitesi domaini (yoksa boş bırak)",
        initial: "",
      },
      {
        type: "text",
        name: "target",
        message: "Hedef klasör",
        initial: (prev, values) => resolve(process.cwd(), "..", values.slug),
      },
      {
        type: "multiselect",
        name: "modules",
        message: "Hangi modüller? (space ile seç, enter ile onayla)",
        instructions: false,
        choices: modules.map((m) => ({ title: `${m.name} — ${m.description}`, value: m.name })),
      },
    ],
    { onCancel: () => process.exit(1) }
  );

  if (!answers.target) process.exit(1);

  const { ordered, added } = resolveSelection(units, answers.modules ?? []);
  if (added.length > 0) {
    console.log("\nBağımlılık olarak eklendi:");
    for (const a of added) console.log(`  + ${a.name} (${a.requiredBy} bunu gerektiriyor)`);
  }

  const target = resolve(answers.target);
  if (existsSync(target) && (await readdir(target)).length > 0) {
    const { ok } = await prompts({
      type: "confirm",
      name: "ok",
      message: `${target} boş değil. İçindeki aynı adlı dosyaların üzerine yazılacak. Devam?`,
      initial: false,
    });
    if (!ok) process.exit(1);
  }

  const vars = {
    APP_NAME: answers.appName,
    APP_SLUG: answers.slug,
    BUNDLE_ID: answers.bundleId,
    DOMAIN: answers.domain || "example.com",
  };

  const { setup } = await generate({ target, ordered, vars });

  console.log(`\n✓ ${target} oluşturuldu.`);
  console.log(`  core: ${ordered.filter((u) => u.isCore).map((u) => u.name).join(", ")}`);
  console.log(`  modüller: ${ordered.filter((u) => !u.isCore).map((u) => u.name).join(", ") || "(yok)"}`);
  console.log("\n" + setup);
  console.log(`\nBu liste ${join(target, "SETUP.md")} dosyasına da yazıldı.`);
  console.log(`Sıradaki: cd ${target} && npm install`);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main().catch((err) => {
    console.error("\nHata:", err.message);
    process.exit(1);
  });
}
