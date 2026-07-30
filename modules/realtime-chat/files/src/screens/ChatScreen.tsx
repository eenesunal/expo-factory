import type { RouteProp } from "@react-navigation/native";
import { useRoute } from "@react-navigation/native";
import { useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { PressableScale } from "../components/PressableScale";
import { sendMessage, useChat } from "../lib/chat";
import type { RootStackParamList } from "../lib/navigation";
import { useTheme } from "../theme";

export function ChatScreen() {
  const route = useRoute<RouteProp<RootStackParamList, "Chat">>();
  const roomId = route.params?.roomId ?? "genel";
  const { colors, fontSizes } = useTheme();
  const { messages, online, loading } = useChat(roomId);
  const [draft, setDraft] = useState("");

  async function handleSend() {
    const body = draft;
    setDraft("");
    const { error } = await sendMessage(roomId, body);
    // Gönderilemezse metni kaybetmiyoruz — kullanıcı tekrar deneyebilsin.
    if (error) setDraft(body);
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.surface }]}>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Text style={[styles.header, { color: colors.inkSoft, fontSize: fontSizes.footnote }]}>
          {roomId} · {online} çevrimiçi
        </Text>

        <FlatList
          data={messages}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            loading ? null : (
              <Text style={{ color: colors.inkSoft, fontSize: fontSizes.body }}>Henüz mesaj yok.</Text>
            )
          }
          renderItem={({ item }) => (
            <View style={[styles.bubble, { backgroundColor: colors.surfaceDeep }]}>
              <Text style={{ color: colors.inkSoft, fontSize: fontSizes.caption }}>
                {item.user_id.slice(0, 8)}
              </Text>
              <Text style={{ color: colors.ink, fontSize: fontSizes.body }}>{item.body}</Text>
            </View>
          )}
        />

        <View style={[styles.composer, { borderColor: colors.border }]}>
          <TextInput
            style={[styles.input, { color: colors.ink, backgroundColor: colors.surfaceDeep }]}
            value={draft}
            onChangeText={setDraft}
            placeholder="Mesaj yaz"
            placeholderTextColor={colors.inkSoft}
            multiline
            maxLength={2000}
          />
          <PressableScale
            style={[styles.send, { backgroundColor: colors.accent }]}
            disabled={draft.trim().length === 0}
            onPress={handleSend}
          >
            <Text style={{ color: colors.surface, fontWeight: "600" }}>Gönder</Text>
          </PressableScale>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 16, paddingTop: 8 },
  list: { padding: 16, gap: 8 },
  bubble: { borderRadius: 12, padding: 12, gap: 2, alignSelf: "flex-start", maxWidth: "88%" },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: 8, padding: 12, borderTopWidth: 1 },
  input: { flex: 1, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10, maxHeight: 120 },
  send: { paddingHorizontal: 18, paddingVertical: 12, borderRadius: 999 },
});
