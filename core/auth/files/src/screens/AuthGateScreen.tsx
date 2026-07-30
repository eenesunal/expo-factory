import { useState } from "react";
import { ActivityIndicator, SafeAreaView, StyleSheet, Text, TextInput, View } from "react-native";
import { PressableScale } from "../components/PressableScale";
import { confirmEmailAuth, startEmailAuth, type StartAuthMode } from "../lib/auth";
import { useTheme } from "../theme";

type Props = {
  onVerified: () => void;
  onCancel: () => void;
};

// E-posta + 6 haneli kod (OTP) ile giriş. Zorunlu bir gate DEĞİL — mevcut
// anonim oturumu gerçek bir hesaba yükseltmek için isteğe bağlı bir ekran.
export function AuthGateScreen({ onVerified, onCancel }: Props) {
  const { colors, fontSizes } = useTheme();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [mode, setMode] = useState<StartAuthMode | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSendCode() {
    setBusy(true);
    setError(null);
    const result = await startEmailAuth(email.trim());
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setMode(result.mode);
  }

  async function handleConfirm() {
    if (!mode) return;
    setBusy(true);
    setError(null);
    const result = await confirmEmailAuth(mode, email.trim(), code.trim());
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onVerified();
  }

  const inputStyle = [
    styles.input,
    { borderColor: colors.border, color: colors.ink, backgroundColor: colors.surfaceDeep },
  ];

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.surface }]}>
      <View style={styles.body}>
        <Text style={[styles.title, { color: colors.ink, fontSize: fontSizes.headline }]}>
          {mode ? "Kodu gir" : "Giriş yap / Hesap oluştur"}
        </Text>
        <Text style={[styles.hint, { color: colors.inkSoft, fontSize: fontSizes.body }]}>
          {mode
            ? `${email} adresine 6 haneli bir kod gönderdik.`
            : "E-posta adresini gir, sana tek kullanımlık bir kod göndereceğiz. Şifre yok."}
        </Text>

        {mode ? (
          <TextInput
            style={inputStyle}
            value={code}
            onChangeText={setCode}
            placeholder="123456"
            placeholderTextColor={colors.inkSoft}
            keyboardType="number-pad"
            maxLength={6}
            autoFocus
          />
        ) : (
          <TextInput
            style={inputStyle}
            value={email}
            onChangeText={setEmail}
            placeholder="ornek@eposta.com"
            placeholderTextColor={colors.inkSoft}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            autoFocus
          />
        )}

        {error ? (
          <Text style={[styles.error, { color: colors.highlight, fontSize: fontSizes.footnote }]}>
            {error}
          </Text>
        ) : null}

        <PressableScale
          style={[styles.button, { backgroundColor: colors.accent }]}
          disabled={busy || (mode ? code.trim().length < 6 : !email.includes("@"))}
          onPress={mode ? handleConfirm : handleSendCode}
        >
          {busy ? (
            <ActivityIndicator color={colors.surface} />
          ) : (
            <Text style={[styles.buttonText, { color: colors.surface, fontSize: fontSizes.subtitle }]}>
              {mode ? "Doğrula" : "Kod gönder"}
            </Text>
          )}
        </PressableScale>

        <PressableScale style={styles.link} haptic="selection" onPress={mode ? () => setMode(null) : onCancel}>
          <Text style={[styles.linkText, { color: colors.inkSoft, fontSize: fontSizes.footnote }]}>
            {mode ? "E-postayı değiştir" : "Vazgeç"}
          </Text>
        </PressableScale>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { flex: 1, justifyContent: "center", padding: 24, gap: 14 },
  title: { fontWeight: "600" },
  hint: { lineHeight: 21 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16 },
  error: { lineHeight: 18 },
  button: { alignItems: "center", justifyContent: "center", minHeight: 50, borderRadius: 999 },
  buttonText: { fontWeight: "600" },
  link: { alignSelf: "center", padding: 10 },
  linkText: {},
});
