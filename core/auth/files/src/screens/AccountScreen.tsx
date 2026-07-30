import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback, useEffect, useState } from "react";
import { Alert, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { PressableScale } from "../components/PressableScale";
import { deleteAccount, getLinkedEmail } from "../lib/auth";
import { notifySignedOut, type RootStackParamList } from "../lib/navigation";
import { reportError } from "../lib/reportError";
import { supabase } from "../lib/supabase";
import { useTheme } from "../theme";

export function AccountScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, "Account">>();
  const { colors, fontSizes } = useTheme();
  const [email, setEmail] = useState<string | null>(null);

  const refresh = useCallback(() => {
    getLinkedEmail()
      .then(setEmail)
      .catch((err) => reportError("E-posta okunamadı", err));
  }, []);

  useEffect(() => {
    refresh();
    return navigation.addListener("focus", refresh);
  }, [navigation, refresh]);

  function confirmDelete() {
    Alert.alert(
      "Hesabı sil",
      "Hesabın ve ona bağlı tüm verin kalıcı olarak silinecek. Bu işlem geri alınamaz.",
      [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "Sil",
          style: "destructive",
          onPress: async () => {
            const { error } = await deleteAccount();
            if (error) {
              Alert.alert("Hesap silinemedi", error);
              return;
            }
            notifySignedOut();
          },
        },
      ]
    );
  }

  async function handleSignOut() {
    await supabase?.auth.signOut();
    notifySignedOut();
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.surface }]}>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={[styles.title, { color: colors.ink, fontSize: fontSizes.headline }]}>Hesap</Text>

        <View style={[styles.card, { backgroundColor: colors.surfaceDeep, borderColor: colors.border }]}>
          <Text style={[styles.label, { color: colors.inkSoft, fontSize: fontSizes.footnote }]}>
            E-posta
          </Text>
          <Text style={[styles.value, { color: colors.ink, fontSize: fontSizes.subtitle }]}>
            {email ?? "Bağlı değil (anonim oturum)"}
          </Text>
        </View>

        {email ? null : (
          <PressableScale
            style={[styles.button, { backgroundColor: colors.accent }]}
            onPress={() => navigation.navigate("Auth")}
          >
            <Text style={[styles.buttonText, { color: colors.surface, fontSize: fontSizes.subtitle }]}>
              Giriş yap / Hesap oluştur
            </Text>
          </PressableScale>
        )}

        {email ? (
          <PressableScale style={[styles.button, { borderColor: colors.border, borderWidth: 1 }]} onPress={handleSignOut}>
            <Text style={[styles.buttonText, { color: colors.ink, fontSize: fontSizes.subtitle }]}>
              Çıkış yap
            </Text>
          </PressableScale>
        ) : null}

        <PressableScale style={styles.link} haptic="medium" onPress={confirmDelete}>
          <Text style={[styles.linkText, { color: colors.highlight, fontSize: fontSizes.footnote }]}>
            Hesabı sil
          </Text>
        </PressableScale>

        <PressableScale style={styles.link} haptic="selection" onPress={() => navigation.goBack()}>
          <Text style={[styles.linkText, { color: colors.inkSoft, fontSize: fontSizes.footnote }]}>Geri</Text>
        </PressableScale>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { padding: 24, gap: 14 },
  title: { fontWeight: "600", marginBottom: 6 },
  card: { borderWidth: 1, borderRadius: 14, padding: 16, gap: 4 },
  label: {},
  value: { fontWeight: "500" },
  button: { alignItems: "center", justifyContent: "center", minHeight: 50, borderRadius: 999 },
  buttonText: { fontWeight: "600" },
  link: { alignSelf: "center", padding: 10 },
  linkText: {},
});
