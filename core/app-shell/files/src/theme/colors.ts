export type ColorScheme = "light" | "dark";

// Marka-nötr başlangıç paleti — kendi renklerinle değiştir. İsimler soyut
// (accent/surface/ink) tutuldu ki değiştirince kullanım yerlerini
// düzeltmek gerekmesin.
export const colors = {
  light: {
    accent: "#3A5A9B",
    accentDeep: "#26406F",
    highlight: "#B4874A",
    highlightSoft: "#E4CBA0",
    surface: "#FAFAF8",
    surfaceDeep: "#F0F0EC",
    ink: "#22252B",
    inkSoft: "#5F6570",
    border: "#DFE0DB",
  },
  dark: {
    accent: "#8FAEE0",
    accentDeep: "#B6CCF0",
    highlight: "#D9AE6E",
    highlightSoft: "#6B5636",
    surface: "#1B1D21",
    surfaceDeep: "#24272C",
    ink: "#ECEEF2",
    inkSoft: "#A5AAB4",
    border: "#33373D",
  },
} as const;

export type ThemeColors = typeof colors.light;
