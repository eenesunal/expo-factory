import * as Notifications from "expo-notifications";
import { useEffect } from "react";
import { Platform } from "react-native";
import { navigationRef } from "./navigation";

// Bildirime dokunulunca `content.data.screen` ile belirtilen ekrana gider.
// Uygulama tamamen kapalıyken açılan bildirim için de çalışır
// (getLastNotificationResponseAsync).
//
// Bildirim üretirken: content.data = { screen: "Feed", params: { postId: 12 } }
export function useNotificationRouting() {
  useEffect(() => {
    if (Platform.OS === "web") return;

    function handleResponse(response: Notifications.NotificationResponse) {
      const data = response.notification.request.content.data as {
        screen?: string;
        params?: Record<string, unknown>;
      } | null;
      if (!data?.screen || !navigationRef.isReady()) return;
      // navigate tipleri runtime'da gelen bir string ile eşleşmediği için
      // burada `never`'a daraltıyoruz — ekran adının RootStackParamList'te
      // gerçekten var olduğunu bildirimi üreten taraf garanti ediyor.
      navigationRef.navigate(data.screen as never, data.params as never);
    }

    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (response) handleResponse(response);
      })
      .catch((err) => console.error("Açılış bildirimi okunamadı:", err));

    const subscription = Notifications.addNotificationResponseReceivedListener(handleResponse);
    return () => subscription.remove();
  }, []);
}
