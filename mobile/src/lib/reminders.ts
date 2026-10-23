// Task alarms as local notifications: they fire even when the app is closed.
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { Item } from './data';

const CHANNEL = 'rappels';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

let ready: Promise<boolean> | null = null;

export function ensureNotifications(): Promise<boolean> {
  ready ??= (async () => {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL, {
        name: 'Rappels de tâches',
        importance: Notifications.AndroidImportance.MAX,
        sound: 'default',
        vibrationPattern: [0, 400, 200, 400],
      });
    }
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    return (await Notifications.requestPermissionsAsync()).granted;
  })();
  return ready;
}

/** Re-schedules one notification per pending task with a future due date (idempotent). */
export async function syncReminders(items: Item[]) {
  if (Platform.OS === 'web' || !(await ensureNotifications())) return;
  const now = Date.now();
  const wanted = new Map(
    items
      .filter((i) => i.type === 'task' && !i.done && i.dueAt && i.dueAt > now)
      .map((i) => [i.id, i]),
  );
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const have = new Map(scheduled.map((n) => [n.identifier, n]));

  for (const n of scheduled) {
    const task = wanted.get(n.identifier);
    if (!task || n.content.data?.dueAt !== task.dueAt || n.content.body !== task.title) {
      await Notifications.cancelScheduledNotificationAsync(n.identifier);
      have.delete(n.identifier);
    }
  }
  for (const task of wanted.values()) {
    if (have.has(task.id)) continue;
    await Notifications.scheduleNotificationAsync({
      identifier: task.id,
      content: { title: '⏰ Rappel', body: task.title, sound: 'default', data: { dueAt: task.dueAt, itemId: task.id } },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: task.dueAt!,
        channelId: CHANNEL,
        delivery: 'alarmClock',
      },
    });
  }
}
