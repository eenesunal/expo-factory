import AsyncStorage from "@react-native-async-storage/async-storage";
import * as BackgroundTask from "expo-background-task";
import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";

export type NotificationContent = {
  title: string;
  body: string;
  // `screen` + `params` verirsen bildirime dokununca useNotificationRouting
  // o ekrana yönlendirir (bkz. notificationRouting.ts).
  data?: { screen?: string; params?: Record<string, unknown> } & Record<string, unknown>;
};

export type DailySchedule = {
  // AsyncStorage anahtarı, bildirim identifier'ı ve background task adının
  // öneki. Aynı uygulamada birden fazla bağımsız bildirim akışı için farklı
  // key kullan ("daily-tip", "reminder" gibi).
  key: string;
  times: [hour: number, minute: number][];
  // Her slot için içerik. İÇERİK HER GÜN YENİDEN ÜRETİLİR — bu yüzden
  // sunucudan taze veri çekebilir.
  contentFor: (slot: { hour: number; minute: number }) => Promise<NotificationContent>;
};

// ponytail: expo-notifications'ın DAILY trigger'ı her gün AYNI içeriği
// tekrarlar. Her gün farklı içerik istiyorsak tek yol bu: sadece bugünün
// henüz geçmemiş saatlerini taze içerikle zamanla, bir günlük background
// task ertesi gün için tazelesin.
//
// DİKKAT: TaskManager.defineTask modül scope'unda çalışmalı (uygulama her
// açılışta task'ı yeniden tanımlamak zorunda), yani bu factory'yi bir
// modülün en üst seviyesinde çağır — bir component içinde ya da lazy
// olarak DEĞİL.
export function createDailyNotifications(schedule: DailySchedule) {
  const storageKey = `notifications_enabled_${schedule.key}`;
  const idPrefix = `${schedule.key}-`;
  const taskName = `${schedule.key}-daily-sync`;

  async function isEnabled(): Promise<boolean> {
    return (await AsyncStorage.getItem(storageKey)) === "true";
  }

  async function cancelAll(): Promise<void> {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      scheduled
        .filter((n) => n.identifier.startsWith(idPrefix))
        .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier))
    );
  }

  async function scheduleToday(): Promise<void> {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== "granted") return;

    await cancelAll();
    const now = new Date();

    for (const [hour, minute] of schedule.times) {
      const triggerDate = new Date(now);
      triggerDate.setHours(hour, minute, 0, 0);
      if (triggerDate.getTime() <= now.getTime()) continue;

      const content = await schedule.contentFor({ hour, minute });

      await Notifications.scheduleNotificationAsync({
        identifier: `${idPrefix}${hour}-${minute}`,
        content,
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: triggerDate },
      });
    }
  }

  async function setEnabled(enabled: boolean): Promise<void> {
    await AsyncStorage.setItem(storageKey, enabled ? "true" : "false");
    if (enabled) {
      await scheduleToday();
      await BackgroundTask.registerTaskAsync(taskName, { minimumInterval: 12 * 60 });
    } else {
      await cancelAll();
      await BackgroundTask.unregisterTaskAsync(taskName);
    }
  }

  TaskManager.defineTask(taskName, async () => {
    try {
      if (await isEnabled()) await scheduleToday();
      return BackgroundTask.BackgroundTaskResult.Success;
    } catch {
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
  });

  return { isEnabled, scheduleToday, setEnabled, cancelAll };
}
