import AsyncStorage from "@react-native-async-storage/async-storage";
import { getLocales } from "expo-localization";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { reportError } from "../lib/reportError";
import { en } from "./locales/en";
import { tr } from "./locales/tr";
import { pickLanguage, translate, type Vars } from "./translate";

export const DICTIONARIES = { tr, en } as const;
export type Language = keyof typeof DICTIONARIES;
export type TKey = keyof typeof tr;

export const LANGUAGES = Object.keys(DICTIONARIES) as Language[];
const DEFAULT_LANGUAGE: Language = "tr";
const STORAGE_KEY = "i18n.language"; // null = telefonun dilini takip et

// Intl.NumberFormat / DateTimeFormat için tam yerel ayar.
const LOCALE: Record<Language, string> = { tr: "tr-TR", en: "en-US" };

function deviceLanguage(): Language {
  return pickLanguage(getLocales().map((l) => l.languageTag), LANGUAGES, DEFAULT_LANGUAGE);
}

type I18n = {
  language: Language;
  /** Kullanıcı elle seçtiyse o dil; null ise telefonun dili takip ediliyor. */
  chosen: Language | null;
  setLanguage: (language: Language | null) => void;
  t: (key: TKey, vars?: Vars) => string;
  locale: string;
};

const I18nContext = createContext<I18n | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [chosen, setChosen] = useState<Language | null>(null);

  useEffect(() => {
    // Okunamazsa telefonun diliyle devam — açılışı bloklamaz (tuzak #9).
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (saved && saved in DICTIONARIES) setChosen(saved as Language);
      })
      .catch((err) => reportError("Dil tercihi okunamadı", err));
  }, []);

  const setLanguage = useCallback((language: Language | null) => {
    setChosen(language);
    const op = language ? AsyncStorage.setItem(STORAGE_KEY, language) : AsyncStorage.removeItem(STORAGE_KEY);
    op.catch((err) => reportError("Dil tercihi kaydedilemedi", err));
  }, []);

  const value = useMemo<I18n>(() => {
    const language = chosen ?? deviceLanguage();
    return {
      language,
      chosen,
      setLanguage,
      t: (key, vars) => translate(DICTIONARIES[language], DICTIONARIES[DEFAULT_LANGUAGE], language, key, vars),
      locale: LOCALE[language],
    };
  }, [chosen, setLanguage]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n, <I18nProvider> dışında kullanıldı — App.tsx'i sarmala (modules/i18n/README.md)");
  return ctx;
}
