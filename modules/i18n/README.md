# modules/i18n

Uygulama içi çoklu dil. Varsayılan TR + EN; i18next yerine bağımlılıksız ~40 satırlık bir çevirici
(`src/i18n/translate.ts`) ve bir React context (`src/i18n/index.tsx`).

## ZORUNLU tek satır

`App.tsx`'te en dıştaki bileşeni sarmala:

```tsx
import { I18nProvider } from "./src/i18n";
...
return (
  <I18nProvider>
    <SafeAreaProvider>...</SafeAreaProvider>
  </I18nProvider>
);
```

create.mjs App.tsx'e ekran enjekte ediyor ama sarmalayıcı eklemiyor — elle yap.

## Kullanım

```tsx
const { t, language, setLanguage, locale } = useI18n();
t("common.ok");                                  // "Tamam" / "OK"
t("notifications.count", { count: 3 });          // { one, other } girdisi -> çoğul
new Intl.NumberFormat(locale).format(1.9);       // "1,9" / "1.9"
setLanguage("en");                               // elle seç (saklanır)
setLanguage(null);                               // telefonun diline dön
```

- **Kaynak dil `tr.ts`.** Anahtar eklerken önce oraya ekle. `en.ts`, `Translation` tipi sayesinde aynı anahtarlar
  olmadan derlenmez — eksik çeviri production'a sızmaz.
- Çalışma anında yine de eksik bir anahtar olursa önce varsayılan dile (TR), o da yoksa **anahtarın kendisine** düşer:
  ekranda `home.title` görürsen çeviri eksiktir. Sessizce boş metin göstermez.
- Çoğul: `{ one: "...", other: "..." }` girdisi + `count` değişkeni; kural `Intl.PluralRules`'tan gelir
  (Hermes'te yerleşik).
- Dil seçimi `AsyncStorage`'da (`i18n.language`); okunamazsa telefonun diliyle açılır, açılışı bloklamaz.

## Test

```bash
npm test   # src/i18n/translate.test.ts dahil
```

## Bilinen sınırlar

- core ekranlarının (Account, AuthGate, Splash) metinleri sabit Türkçe; İngilizce sunacak uygulamada `t()`'ye taşınmalı.
- Sağdan sola diller (Arapça) için `I18nManager.forceRTL` + yeniden başlatma gerekir; kapsanmadı.
- ICU mesaj formatı yok; ihtiyaç olursa i18next'e geç (`t(key, vars)` imzası korunabilir).
