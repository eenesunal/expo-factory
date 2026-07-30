import { useCallback, useEffect, useState } from "react";
import { FlatList, RefreshControl, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { LikeButton } from "../components/LikeButton";
import { commentCounts, fetchPosts, PAGE_SIZE, type Post } from "../lib/feed";
import { likeCounts } from "../lib/likes";
import { useTheme } from "../theme";

// Başlangıç ekranı — gönderi oluşturma, yorum ekranı ve profil bilgisi
// bilinçli olarak eklenmedi (her uygulamada farklı). fetchPosts/createPost/
// fetchComments src/lib/feed.ts'de hazır.
export function FeedScreen() {
  const { colors, fontSizes } = useTheme();
  const [posts, setPosts] = useState<Post[]>([]);
  const [likes, setLikes] = useState<Record<string, number>>({});
  const [comments, setComments] = useState<Record<number, number>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [reachedEnd, setReachedEnd] = useState(false);

  // Sayıları tek seferde çekiyoruz — her satır için ayrı sorgu atmak listeyi
  // kilitler.
  const loadCounts = useCallback(async (rows: Post[]) => {
    if (rows.length === 0) return;
    const [likeMap, commentMap] = await Promise.all([
      likeCounts(rows.map((p) => `post:${p.id}`)),
      commentCounts(rows.map((p) => p.id)),
    ]);
    setLikes((prev) => ({ ...prev, ...likeMap }));
    setComments((prev) => ({ ...prev, ...commentMap }));
  }, []);

  const load = useCallback(async () => {
    setRefreshing(true);
    const rows = await fetchPosts();
    setPosts(rows);
    setReachedEnd(rows.length < PAGE_SIZE);
    await loadCounts(rows);
    setRefreshing(false);
  }, [loadCounts]);

  useEffect(() => {
    load().catch((err) => console.error("Akış yüklenemedi:", err));
  }, [load]);

  async function loadMore() {
    if (loadingMore || reachedEnd || posts.length === 0) return;
    setLoadingMore(true);
    const rows = await fetchPosts(posts[posts.length - 1].created_at);
    setPosts((prev) => [...prev, ...rows]);
    setReachedEnd(rows.length < PAGE_SIZE);
    await loadCounts(rows);
    setLoadingMore(false);
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.surface }]}>
      <FlatList
        data={posts}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.accent} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          refreshing ? null : (
            <Text style={{ color: colors.inkSoft, fontSize: fontSizes.body, padding: 24 }}>
              Henüz gönderi yok.
            </Text>
          )
        }
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: colors.surfaceDeep, borderColor: colors.border }]}>
            <Text style={[styles.body, { color: colors.ink, fontSize: fontSizes.body }]}>{item.body}</Text>
            <View style={styles.row}>
              <LikeButton entityId={`post:${item.id}`} count={likes[`post:${item.id}`] ?? 0} />
              <Text style={{ color: colors.inkSoft, fontSize: fontSizes.footnote }}>
                {comments[item.id] ?? 0} yorum
              </Text>
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  list: { padding: 16, gap: 12 },
  card: { borderWidth: 1, borderRadius: 14, padding: 16, gap: 8 },
  body: { lineHeight: 21 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
});
