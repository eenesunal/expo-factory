import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRef, useState } from "react";
import { SafeAreaView, StyleSheet, Text, View } from "react-native";
import { PressableScale } from "../components/PressableScale";
import type { RootStackParamList } from "../lib/navigation";
import { useTheme } from "../theme";

// Okunacak kod tipleri — dar tutmak yanlış okumaları azaltır.
const BARCODE_TYPES = ["qr", "ean13", "code128"] as const;

export function ScanScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, "Scan">>();
  const { colors, fontSizes } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [result, setResult] = useState<string | null>(null);
  // onBarcodeScanned aynı kod için saniyede onlarca kez tetiklenir — ilk
  // okumadan sonra kilitliyoruz, yoksa navigate/istek defalarca çalışır.
  const locked = useRef(false);

  function handleScanned({ data }: { data: string }) {
    if (locked.current) return;
    locked.current = true;
    // Okunan veri DIŞARIDAN GELEN BİR GİRDİ — doğrulamadan kullanma.
    // (URL ise şemasını kontrol et, kendi ID formatına uyuyor mu bak.)
    setResult(data);
  }

  function scanAgain() {
    locked.current = false;
    setResult(null);
  }

  if (!permission) {
    return <SafeAreaView style={[styles.root, { backgroundColor: colors.surface }]} />;
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={[styles.root, styles.center, { backgroundColor: colors.surface }]}>
        <Text style={[styles.info, { color: colors.ink, fontSize: fontSizes.body }]}>
          QR kod okumak için kamera izni gerekiyor.
        </Text>
        <PressableScale
          style={[styles.button, { backgroundColor: colors.accent }]}
          onPress={requestPermission}
        >
          <Text style={{ color: colors.surface, fontWeight: "600" }}>İzin ver</Text>
        </PressableScale>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: "#000" }]}>
      {result ? (
        <View style={[styles.center, styles.resultBox, { backgroundColor: colors.surface }]}>
          <Text style={[styles.info, { color: colors.ink, fontSize: fontSizes.body }]}>{result}</Text>
          <PressableScale style={[styles.button, { backgroundColor: colors.accent }]} onPress={scanAgain}>
            <Text style={{ color: colors.surface, fontWeight: "600" }}>Tekrar tara</Text>
          </PressableScale>
          <PressableScale style={styles.link} haptic="selection" onPress={() => navigation.goBack()}>
            <Text style={{ color: colors.inkSoft, fontSize: fontSizes.footnote }}>Kapat</Text>
          </PressableScale>
        </View>
      ) : (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: [...BARCODE_TYPES] }}
          onBarcodeScanned={handleScanned}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, padding: 24 },
  resultBox: {},
  info: { textAlign: "center", lineHeight: 21 },
  button: { paddingHorizontal: 22, paddingVertical: 12, borderRadius: 999 },
  link: { padding: 10 },
});
