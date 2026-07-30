import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { StyleSheet, Text } from "react-native";
import { isLiked, toggleLike } from "../lib/likes";
import { reportError } from "../lib/reportError";
import { useTheme } from "../theme";
import { PressableScale } from "./PressableScale";

type Props = {
  entityId: string;
  // Biliniyorsa ver (liste ekranında likeCounts ile tek seferde çekilmiş
  // olabilir) — verilmezse sayı gösterilmez.
  count?: number;
};

export function LikeButton({ entityId, count }: Props) {
  const { colors, fontSizes } = useTheme();
  const [liked, setLiked] = useState(false);
  const [localCount, setLocalCount] = useState(count);

  useEffect(() => {
    let active = true;
    isLiked(entityId)
      .then((value) => {
        if (active) setLiked(value);
      })
      .catch((err) => reportError("Beğeni durumu okunamadı", err));
    return () => {
      active = false;
    };
  }, [entityId]);

  useEffect(() => setLocalCount(count), [count]);

  async function handlePress() {
    // İyimser güncelleme — RPC yavaşsa buton anında tepki vermeli. Hata olursa
    // geri alıyoruz.
    const next = !liked;
    setLiked(next);
    setLocalCount((c) => (c === undefined ? c : c + (next ? 1 : -1)));
    try {
      const actual = await toggleLike(entityId);
      setLiked(actual);
    } catch (err) {
      reportError("Beğeni değiştirilemedi", err);
      setLiked(!next);
      setLocalCount((c) => (c === undefined ? c : c + (next ? -1 : 1)));
    }
  }

  return (
    <PressableScale
      style={styles.root}
      haptic="medium"
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={liked ? "Beğeniyi kaldır" : "Beğen"}
      accessibilityState={{ selected: liked }}
    >
      <Ionicons
        name={liked ? "heart" : "heart-outline"}
        size={20}
        color={liked ? colors.highlight : colors.inkSoft}
      />
      {localCount === undefined ? null : (
        <Text style={{ color: colors.inkSoft, fontSize: fontSizes.footnote }}>{localCount}</Text>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: "row", alignItems: "center", gap: 6, padding: 8 },
});
