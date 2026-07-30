import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { SafeAreaView, StyleSheet, Text, View } from "react-native";
import { PressableScale } from "../components/PressableScale";
import type { RootStackParamList } from "../lib/navigation";
import { useTheme } from "../theme";

// Başlangıç ekranı — burayı kendi uygulamanın ana ekranıyla değiştir.
export function HomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, "Home">>();
  const { colors, fontSizes } = useTheme();

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.surface }]}>
      <View style={styles.body}>
        <Text style={[styles.title, { color: colors.ink, fontSize: fontSizes.headline }]}>
          __APP_NAME__
        </Text>
        <Text style={[styles.hint, { color: colors.inkSoft, fontSize: fontSizes.body }]}>
          Bu ekran `src/screens/HomeScreen.tsx` içinde. Kurulan modüllerin
          ekranları `App.tsx`'teki stack'e eklendi — buradan `navigation.navigate(...)`
          ile geç.
        </Text>
        <PressableScale
          style={[styles.button, { backgroundColor: colors.accent }]}
          onPress={() => navigation.navigate("Account")}
        >
          <Text style={[styles.buttonText, { color: colors.surface, fontSize: fontSizes.subtitle }]}>
            Hesap
          </Text>
        </PressableScale>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { flex: 1, justifyContent: "center", padding: 24, gap: 16 },
  title: { fontWeight: "600" },
  hint: { lineHeight: 21 },
  button: { alignSelf: "flex-start", paddingHorizontal: 22, paddingVertical: 12, borderRadius: 999 },
  buttonText: { fontWeight: "600" },
});
