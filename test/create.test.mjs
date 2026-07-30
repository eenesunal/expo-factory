// create.mjs'in kritik mantığı: bağımlılık çözümlemesi, birleştirme ve üretim.
// Çalıştır: npm test
import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyVars, generate, loadUnits, mergeInto, parseDep, resolveSelection } from "../create.mjs";

const units = await loadUnits();
const CORE = ["app-shell", "auth", "eas-setup", "notifications", "marketing-site"];

test("tüm manifestler yüklenir ve core işaretlenir", () => {
  for (const name of CORE) {
    assert.equal(units.get(name)?.isCore, true, `${name} core olmalı`);
  }
  assert.ok(units.size >= 25, `beklenenden az birim: ${units.size}`);
  // Her modülün açıklaması ve dependsOn'ı olmalı (create.mjs bunlara güveniyor).
  for (const unit of units.values()) {
    assert.ok(unit.description, `${unit.name}: description eksik`);
    assert.ok(Array.isArray(unit.dependsOn), `${unit.name}: dependsOn dizi olmalı`);
    for (const dep of unit.dependsOn) {
      assert.ok(units.has(dep), `${unit.name}: bilinmeyen bağımlılık ${dep}`);
    }
  }
});

test("hiç modül seçilmese bile core dahil edilir", () => {
  const { ordered, added } = resolveSelection(units, []);
  const names = ordered.map((u) => u.name);
  assert.deepEqual([...names].sort(), [...CORE].sort());
  // app-shell ilk olmalı: package.json/app.json/App.tsx tabanını o getiriyor,
  // diğer birimler bunların üstüne yazıyor.
  assert.equal(names[0], "app-shell");
  assert.deepEqual(added, []);
});

test("core birimleri modüllerden önce gelir", () => {
  const { ordered } = resolveSelection(units, ["feed", "rag"]);
  const firstModuleIndex = ordered.findIndex((u) => !u.isCore);
  const lastCoreIndex = ordered.reduce((last, u, i) => (u.isCore ? i : last), -1);
  assert.ok(lastCoreIndex < firstModuleIndex, "core birimleri modüllerden sonra kaldı");
});

test("dependsOn transitif olarak çözülür: paywall-gate -> revenuecat", () => {
  const { ordered, added } = resolveSelection(units, ["paywall-gate"]);
  const names = ordered.map((u) => u.name);
  assert.ok(names.includes("revenuecat"), "revenuecat eklenmedi");
  // Bağımlılık, ona ihtiyaç duyandan ÖNCE gelmeli (dosya kopyalama ve schema
  // sırası buna dayanıyor).
  assert.ok(names.indexOf("revenuecat") < names.indexOf("paywall-gate"));
  assert.deepEqual(added, [{ name: "revenuecat", requiredBy: "paywall-gate" }]);
});

test("dependsOn zinciri: referral -> credits, feed -> likes", () => {
  const { ordered, added } = resolveSelection(units, ["referral", "feed"]);
  const names = ordered.map((u) => u.name);
  assert.ok(names.indexOf("credits") < names.indexOf("referral"));
  assert.ok(names.indexOf("likes") < names.indexOf("feed"));
  assert.deepEqual(
    added.map((a) => a.name).sort(),
    ["credits", "likes"]
  );
});

test("kullanıcı bağımlılığı zaten seçtiyse 'eklendi' denmez", () => {
  const { added } = resolveSelection(units, ["revenuecat", "paywall-gate"]);
  assert.deepEqual(added, []);
});

test("seçilmeyen modül hiç dahil edilmez", () => {
  const { ordered } = resolveSelection(units, ["likes", "leaderboard", "qr-scan"]);
  const names = ordered.map((u) => u.name);
  for (const excluded of ["rag", "revenuecat", "credits", "media-render", "feed"]) {
    assert.ok(!names.includes(excluded), `${excluded} dahil edilmemeliydi`);
  }
});

test("bilinmeyen modül ve döngü hata verir", () => {
  assert.throws(() => resolveSelection(units, ["yok-boyle-bir-sey"]), /Bilinmeyen modül/);

  const cyclic = new Map([
    ["a", { name: "a", dependsOn: ["b"], isCore: false }],
    ["b", { name: "b", dependsOn: ["a"], isCore: false }],
  ]);
  assert.throws(() => resolveSelection(cyclic, ["a"]), /döngü/);
});

test("parseDep scoped paketleri doğru ayırır", () => {
  assert.deepEqual(parseDep("expo-camera@~57.0.0"), ["expo-camera", "~57.0.0"]);
  assert.deepEqual(parseDep("@expo/vector-icons@^15.0.2"), ["@expo/vector-icons", "^15.0.2"]);
  assert.deepEqual(parseDep("sharp"), ["sharp", "latest"]);
});

test("mergeInto dizileri birleştirir, objeleri derin birleştirir", () => {
  const target = { plugins: ["a"], ios: { supportsTablet: false } };
  mergeInto(target, { plugins: ["b"], ios: { usesAppleSignIn: true }, scheme: "x" });
  assert.deepEqual(target, {
    plugins: ["a", "b"],
    ios: { supportsTablet: false, usesAppleSignIn: true },
    scheme: "x",
  });
});

test("applyVars bilinmeyen placeholder'ı olduğu gibi bırakır", () => {
  assert.equal(applyVars("__APP_NAME__ / __YOK__", { APP_NAME: "Test" }), "Test / __YOK__");
});

// --- uçtan uca üretim ---

async function build(modules, vars = {}) {
  const target = await mkdtemp(join(tmpdir(), "expo-factory-test-"));
  const { ordered } = resolveSelection(units, modules);
  await generate({
    target,
    ordered,
    vars: { APP_NAME: "Test App", APP_SLUG: "test-app", BUNDLE_ID: "com.test.app", DOMAIN: "test.example", ...vars },
  });
  return { target, ordered };
}

test("üretim: RAG'siz bir koleksiyon uygulaması", async () => {
  const { target } = await build(["media-render", "likes", "leaderboard", "qr-scan"]);
  try {
    const schema = await readFile(join(target, "supabase", "schema.sql"), "utf8");
    assert.match(schema, /create table if not exists likes/);
    assert.match(schema, /create table if not exists scores/);
    // RAG ve kredi şemasının zerresi girmemeli.
    assert.doesNotMatch(schema, /rag_documents/);
    assert.doesNotMatch(schema, /credit_balances/);
    // profiles (core/auth) her zaman ve önce gelmeli — modüller ona referans veriyor.
    assert.ok(schema.indexOf("create table if not exists profiles") < schema.indexOf("create table if not exists likes"));

    const pkg = JSON.parse(await readFile(join(target, "package.json"), "utf8"));
    assert.equal(pkg.name, "test-app");
    assert.ok(pkg.dependencies["expo-camera"], "qr-scan bağımlılığı eklenmedi");
    // Hiçbir modül seçilmese de core'un kullandığı altyapı paketleri gelmeli
    // (auth/notifications/rating-prompt AsyncStorage, rating-prompt/deep-linking
    // expo-linking kullanıyor).
    assert.ok(pkg.dependencies["@react-native-async-storage/async-storage"]);
    assert.ok(pkg.dependencies["expo-linking"]);
    assert.ok(!pkg.dependencies["react-native-purchases"], "seçilmeyen modülün bağımlılığı eklendi");

    const appJson = JSON.parse(await readFile(join(target, "app.json"), "utf8"));
    assert.equal(appJson.expo.name, "Test App");
    assert.equal(appJson.expo.ios.bundleIdentifier, "com.test.app");
    // expo-background-task (core/notifications) + expo-camera (qr-scan) + expo-sharing (media-render)
    const pluginNames = appJson.expo.plugins.map((p) => (Array.isArray(p) ? p[0] : p));
    assert.ok(pluginNames.includes("expo-background-task"));
    assert.ok(pluginNames.includes("expo-camera"));

    const appTsx = await readFile(join(target, "App.tsx"), "utf8");
    assert.match(appTsx, /import \{ LeaderboardScreen \}/);
    assert.match(appTsx, /<Stack\.Screen name="Scan" component=\{ScanScreen\} \/>/);
    assert.doesNotMatch(appTsx, /@factory:/, "işaretçiler değiştirilmemiş");

    const nav = await readFile(join(target, "src", "lib", "navigation.ts"), "utf8");
    assert.match(nav, /Leaderboard: undefined;/);
    assert.doesNotMatch(nav, /@factory:routes/);

    const env = await readFile(join(target, ".env.example"), "utf8");
    assert.match(env, /EXPO_PUBLIC_SUPABASE_URL=/);
    assert.match(env, /EXPO_PUBLIC_MEDIA_RENDER_URL=/);
    assert.doesNotMatch(env, /OPENAI_API_KEY/);

    const setup = await readFile(join(target, "SETUP.md"), "utf8");
    assert.match(setup, /setup-eas-env\.mjs/);
    assert.match(setup, /### media-render/);

    // Binary asset bozulmadan kopyalandı mı (placeholder değişimi .ttf'e
    // dokunmamalı).
    const font = await readFile(join(target, "server", "media-render", "fonts", "Inter_500Medium.ttf"));
    assert.equal(font.subarray(0, 4).toString("hex"), "00010000", "font dosyası bozulmuş");
  } finally {
    await rm(target, { recursive: true, force: true });
  }
});

test("üretim: parametreli rota ve bağımlılık zinciri", async () => {
  const { target, ordered } = await build(["rag", "geolocation", "push-remote", "realtime-chat", "referral"]);
  try {
    assert.ok(ordered.map((u) => u.name).includes("credits"), "referral credits'i çekmeliydi");

    const nav = await readFile(join(target, "src", "lib", "navigation.ts"), "utf8");
    assert.match(nav, /Chat: \{ roomId: string \};/);

    const schema = await readFile(join(target, "supabase", "schema.sql"), "utf8");
    // referral, credits'in add_credit'ini çağırıyor — credits şeması ÖNCE gelmeli.
    assert.ok(schema.indexOf("function public.add_credit") < schema.indexOf("function public.redeem_referral"));
    assert.match(schema, /create extension if not exists vector/);

    const env = await readFile(join(target, ".env.example"), "utf8");
    assert.match(env, /OPENAI_API_KEY=/);
    assert.doesNotMatch(env, /REVENUECAT/);

    // deep-linking seçilmediği için .well-known kopyalanmamalı.
    const docs = await readFile(join(target, "docs", "index.html"), "utf8");
    assert.match(docs, /test\.example/);
    assert.doesNotMatch(docs, /__DOMAIN__/);
  } finally {
    await rm(target, { recursive: true, force: true });
  }
});

// error-tracking'in tüm mekanizması core dosyalarını ezmeye dayanıyor: modül
// kendi reportError.ts ve index.ts'ini app-shell'inkilerin ÜZERİNE yazıyor.
// Kopyalama sırası bozulursa modül sessizce hiçbir şey yapmaz — bu yüzden test.
test("error-tracking core'un reportError.ts ve index.ts'ini ezer", async () => {
  const { target } = await build(["error-tracking"]);
  try {
    const report = await readFile(join(target, "src", "lib", "reportError.ts"), "utf8");
    assert.match(report, /@sentry\/react-native/, "core'un no-op sürümü ezilmemiş");
    assert.match(report, /fingerprint: \[message\]/);

    const index = await readFile(join(target, "index.ts"), "utf8");
    assert.match(index, /Sentry\.init/);
    assert.match(index, /Sentry\.wrap\(App\)/);

    const pkg = JSON.parse(await readFile(join(target, "package.json"), "utf8"));
    assert.ok(pkg.dependencies["@sentry/react-native"]);

    const env = await readFile(join(target, ".env.example"), "utf8");
    assert.match(env, /EXPO_PUBLIC_SENTRY_DSN=/);
    assert.match(env, /SENTRY_AUTH_TOKEN=/);

    // app-shell'in geri kalanı yerinde kalmalı (cp ezmiyor, birleştiriyor).
    await readFile(join(target, "src", "lib", "navigation.ts"), "utf8");
  } finally {
    await rm(target, { recursive: true, force: true });
  }
});

test("error-tracking seçilmezse core'un no-op reportError'ı kalır", async () => {
  const { target } = await build(["likes"]);
  try {
    const report = await readFile(join(target, "src", "lib", "reportError.ts"), "utf8");
    assert.match(report, /isErrorReportingEnabled = false/);
    // Yorumlarda "Sentry" geçmesi normal — sızmaması gereken şey import.
    assert.doesNotMatch(report, /@sentry\/react-native/, "seçilmeyen modülün kodu sızdı");

    const index = await readFile(join(target, "index.ts"), "utf8");
    assert.doesNotMatch(index, /Sentry/);

    const pkg = JSON.parse(await readFile(join(target, "package.json"), "utf8"));
    assert.ok(!pkg.dependencies["@sentry/react-native"]);
  } finally {
    await rm(target, { recursive: true, force: true });
  }
});
