// Saf çeviri mantığı — React/React Native'e bağımlı değil, `npm test` ile
// node'da test edilir (bkz. translate.test.ts).
//
// ponytail: i18next yerine ~40 satır. Tavan: dil başına tek dosya, ICU mesaj
// formatı yok (sadece {değişken} ve one/other çoğul). Çok dilli (5+) ya da
// çevirmen aracına (Crowdin vb.) bağlanan bir projede i18next + react-i18next'e
// geç; `t(key, vars)` imzası aynı kalabilir.

export type Plural = { one: string; other: string };
export type Entry = string | Plural;
export type Dict = Record<string, Entry>;
export type Vars = Record<string, string | number>;

export function translate(dict: Dict, fallback: Dict, lang: string, key: string, vars?: Vars): string {
  const entry = dict[key] ?? fallback[key];
  if (entry === undefined) return key; // eksik anahtar ekranda görünür, sessizce kaybolmaz
  let text: string;
  if (typeof entry === "string") {
    text = entry;
  } else {
    const n = Number(vars?.count ?? 0);
    text = new Intl.PluralRules(lang).select(n) === "one" ? entry.one : entry.other;
  }
  return text.replace(/\{(\w+)\}/g, (match, name) => (vars && name in vars ? String(vars[name]) : match));
}

// Cihazın dil sıralamasından ("tr-TR", "en-GB", ...) desteklenen ilk dili seçer.
export function pickLanguage<L extends string>(deviceTags: string[], supported: readonly L[], fallback: L): L {
  for (const tag of deviceTags) {
    const base = tag.toLowerCase().split(/[-_]/)[0];
    const hit = supported.find((lang) => lang === base);
    if (hit) return hit;
  }
  return fallback;
}
