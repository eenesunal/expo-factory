import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Alert, StyleSheet, Text, TextInput, View } from "react-native";
import { AnimatedModal } from "./AnimatedModal";
import { PressableScale } from "./PressableScale";
import { blockUser, reportContent, type ReportTarget } from "../lib/moderation";
import { useTheme } from "../theme";

type Props = {
  target: ReportTarget;
  // Verilirse "bu kullanıcıyı engelle" seçeneği de gösterilir (Apple Guideline
  // 1.2 raporlamanın yanında engellemeyi de istiyor).
  authorId?: string;
};

export function ReportButton({ target, authorId }: Props) {
  const { colors, fontSizes } = useTheme();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    const { error } = await reportContent(target, reason);
    setBusy(false);
    setOpen(false);
    setReason("");
    Alert.alert(
      error ? "Gönderilemedi" : "Aldık",
      error ?? "Raporun bize ulaştı. 24 saat içinde inceleyeceğiz."
    );
  }

  function confirmBlock() {
    if (!authorId) return;
    Alert.alert("Kullanıcıyı engelle", "Bu kullanıcının içeriğini bir daha görmeyeceksin.", [
      { text: "Vazgeç", style: "cancel" },
      {
        text: "Engelle",
        style: "destructive",
        onPress: async () => {
          const { error } = await blockUser(authorId);
          setOpen(false);
          if (error) Alert.alert("Engellenemedi", error);
        },
      },
    ]);
  }

  return (
    <>
      <PressableScale
        style={styles.trigger}
        haptic="selection"
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Bildir"
      >
        <Ionicons name="flag-outline" size={18} color={colors.inkSoft} />
      </PressableScale>

      <AnimatedModal visible={open} onClose={() => setOpen(false)}>
        <View style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.ink, fontSize: fontSizes.title }]}>
            İçeriği bildir
          </Text>
          <TextInput
            style={[styles.input, { color: colors.ink, backgroundColor: colors.surfaceDeep, borderColor: colors.border }]}
            value={reason}
            onChangeText={setReason}
            placeholder="Sorun ne? (kısaca yaz)"
            placeholderTextColor={colors.inkSoft}
            multiline
            maxLength={500}
          />
          <PressableScale
            style={[styles.button, { backgroundColor: colors.accent }]}
            disabled={busy || reason.trim().length === 0}
            onPress={submit}
          >
            <Text style={{ color: colors.surface, fontWeight: "600" }}>Bildir</Text>
          </PressableScale>

          {authorId ? (
            <PressableScale style={styles.link} haptic="medium" onPress={confirmBlock}>
              <Text style={{ color: colors.highlight, fontSize: fontSizes.footnote }}>
                Bu kullanıcıyı engelle
              </Text>
            </PressableScale>
          ) : null}

          <PressableScale style={styles.link} haptic="selection" onPress={() => setOpen(false)}>
            <Text style={{ color: colors.inkSoft, fontSize: fontSizes.footnote }}>Vazgeç</Text>
          </PressableScale>
        </View>
      </AnimatedModal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: { padding: 8 },
  sheet: { width: "100%", maxWidth: 420, borderWidth: 1, borderRadius: 18, padding: 20, gap: 12 },
  title: { fontWeight: "600" },
  input: { borderWidth: 1, borderRadius: 12, padding: 12, minHeight: 90, textAlignVertical: "top" },
  button: { alignItems: "center", justifyContent: "center", minHeight: 48, borderRadius: 999 },
  link: { alignSelf: "center", padding: 8 },
});
