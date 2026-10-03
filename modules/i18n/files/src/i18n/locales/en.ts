import type { Entry } from "../translate";
import type { tr } from "./tr";

// tr.ts'teki her anahtar burada zorunlu — eksik çeviri TypeScript hatasıdır.
export type Translation = { [K in keyof typeof tr]: Entry };

export const en: Translation = {
  "common.ok": "OK",
  "common.cancel": "Cancel",
  "common.retry": "Try again",
  "common.loading": "Loading…",
  "settings.language": "Language",
  "settings.languageSystem": "Phone language",
};
