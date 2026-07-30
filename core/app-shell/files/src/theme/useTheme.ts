import { useColorScheme } from "react-native";
import { colors } from "./colors";
import { fonts, fontSizes } from "./typography";

export function useTheme() {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  return { colors: colors[scheme], fonts, fontSizes, scheme };
}
