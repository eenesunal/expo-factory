import { useEffect, useState } from "react";
import { FlatList, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { myRank, topScores, type ScoreRow } from "../lib/leaderboard";
import { reportError } from "../lib/reportError";
import { useTheme } from "../theme";

const BOARD = "default";

export function LeaderboardScreen() {
  const { colors, fontSizes } = useTheme();
  const [rows, setRows] = useState<ScoreRow[]>([]);
  const [mine, setMine] = useState<{ rank: number; score: number } | null>(null);

  useEffect(() => {
    Promise.all([topScores(BOARD), myRank(BOARD)])
      .then(([top, own]) => {
        setRows(top);
        setMine(own);
      })
      .catch((err) => reportError("Sıralama yüklenemedi", err));
  }, []);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.surface }]}>
      <Text style={[styles.title, { color: colors.ink, fontSize: fontSizes.headline }]}>Sıralama</Text>

      {mine ? (
        <View style={[styles.mine, { backgroundColor: colors.surfaceDeep, borderColor: colors.border }]}>
          <Text style={{ color: colors.inkSoft, fontSize: fontSizes.footnote }}>Senin sıran</Text>
          <Text style={{ color: colors.ink, fontSize: fontSizes.title, fontWeight: "600" }}>
            #{mine.rank} · {mine.score}
          </Text>
        </View>
      ) : null}

      <FlatList
        data={rows}
        keyExtractor={(item) => item.userId}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={{ color: colors.inkSoft, fontSize: fontSizes.body }}>Henüz skor yok.</Text>
        }
        renderItem={({ item }) => (
          <View style={[styles.row, { borderColor: colors.border }]}>
            <Text style={[styles.rank, { color: colors.highlight, fontSize: fontSizes.subtitle }]}>
              {item.rank}
            </Text>
            {/* Kullanıcı adı göstermek için profiles'a display_name ekleyip
                burada join et — şu an sadece kısaltılmış id gösteriliyor. */}
            <Text style={{ color: colors.ink, fontSize: fontSizes.body, flex: 1 }}>
              {item.userId.slice(0, 8)}
            </Text>
            <Text style={{ color: colors.inkSoft, fontSize: fontSizes.body }}>{item.score}</Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 20, gap: 14 },
  title: { fontWeight: "600" },
  mine: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 2 },
  list: { gap: 2, paddingBottom: 24 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1 },
  rank: { fontWeight: "700", minWidth: 28 },
});
