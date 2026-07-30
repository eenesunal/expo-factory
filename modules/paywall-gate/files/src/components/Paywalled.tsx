import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useEntitlement } from "../lib/entitlements";
import { useTheme } from "../theme";
import { PressableScale } from "./PressableScale";

type Props = {
  entitlement: string;
  children: React.ReactNode;
  // Paywall ekranını aç. Kendi ekranını yaz (getOffering() + purchasePackage()
  // ile) ve buraya bağla.
  onUpgrade: () => void;
  title?: string;
  description?: string;
  // Kilitli halde içeriği bulanık/kısıtlı göstermek istersen kendi
  // placeholder'ını ver.
  locked?: React.ReactNode;
};

// ponytail: tek bir gate bileşeni — özellik bazlı flag sistemi, remote config
// ya da izin matrisi YOK. Ceiling: entitlement adı derleme zamanında sabit.
// Yükseltme yolu: gerçekten sunucudan yönetilen özellik bayrakları gerekince
// remote config ekle.
export function Paywalled({ entitlement, children, onUpgrade, title, description, locked }: Props) {
  const { active, loading } = useEntitlement(entitlement);
  const { colors, fontSizes } = useTheme();

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (active) return <>{children}</>;

  return (
    <View style={styles.wrap}>
      {locked}
      <View style={[styles.card, { backgroundColor: colors.surfaceDeep, borderColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.ink, fontSize: fontSizes.title }]}>
          {title ?? "Bu özellik Pro'da"}
        </Text>
        <Text style={[styles.description, { color: colors.inkSoft, fontSize: fontSizes.body }]}>
          {description ?? "Yükselterek bu özelliğin kilidini açabilirsin."}
        </Text>
        <PressableScale style={[styles.button, { backgroundColor: colors.accent }]} onPress={onUpgrade}>
          <Text style={[styles.buttonText, { color: colors.surface, fontSize: fontSizes.subtitle }]}>
            Yükselt
          </Text>
        </PressableScale>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { padding: 24, alignItems: "center" },
  wrap: { gap: 12 },
  card: { borderWidth: 1, borderRadius: 16, padding: 20, gap: 10 },
  title: { fontWeight: "600" },
  description: { lineHeight: 21 },
  button: { alignItems: "center", justifyContent: "center", minHeight: 48, borderRadius: 999 },
  buttonText: { fontWeight: "600" },
});
