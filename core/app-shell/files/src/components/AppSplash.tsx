import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useTheme } from "../theme";

// ponytail: expo-splash-screen + animasyonlu bir açılış ekranı yerine düz bir
// view. Ceiling: marka animasyonu yok. Yükseltme yolu: expo-splash-screen
// kurup app.json'a plugin config'ini ekle, buradaki view'ı kendi
// animasyonunla değiştir.
export function AppSplash() {
  const { colors, fontSizes } = useTheme();
  return (
    <View style={[styles.root, { backgroundColor: colors.surface }]}>
      <Text style={[styles.title, { color: colors.ink, fontSize: fontSizes.headline }]}>
        __APP_NAME__
      </Text>
      <ActivityIndicator color={colors.accent} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center", gap: 20 },
  title: { fontWeight: "600" },
});
