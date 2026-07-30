// Sistem fontları — özel font eklemek istersen `expo-font` +
// `@expo-google-fonts/<font>` kurup burada isimlerini değiştir, App.tsx'te
// `useFonts` ile yükle. DİKKAT: useFonts ne true ne de error dönmeden askıda
// kalabilir; splash'ta sonsuza dek kalmamak için bir timeout ekle
// (App.tsx'teki oturum timeout deseninin aynısı).
export const fonts = {
  serif: undefined as string | undefined,
  sans: undefined as string | undefined,
} as const;

export const fontSizes = {
  caption: 11,
  footnote: 12,
  body: 14,
  subtitle: 15,
  title: 18,
  headline: 22,
} as const;
