// Task alarms as local notifications: they fire even when the app is closed.
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { Item } from './data';
import { challengeEnd, dayKey, type Habit } from './discipline';

const CHANNEL = 'rappels';
const HABIT_PREFIX = 'habit:';

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
  const scheduled = (await Notifications.getAllScheduledNotificationsAsync()).filter((n) => !n.identifier.startsWith(HABIT_PREFIX));
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
      content: { title: 'Rappel', body: task.title, sound: 'default', data: { dueAt: task.dueAt, itemId: task.id } },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: task.dueAt!,
        channelId: CHANNEL,
        delivery: 'alarmClock',
      },
    });
  }
}

/**
 * Re-creates the repeating reminders of habits that have a reminder time (idempotent):
 * daily/challenge every day, weekly on the chosen weekdays, monthly on the chosen day.
 */
export async function syncHabitReminders(habits: Habit[]) {
  if (Platform.OS === 'web' || !(await ensureNotifications())) return;
  const T = Notifications.SchedulableTriggerInputTypes;
  const today = dayKey(new Date());
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of scheduled) if (n.identifier.startsWith(HABIT_PREFIX)) await Notifications.cancelScheduledNotificationAsync(n.identifier);

  for (const h of habits) {
    if (!h.reminderTime || h.archivedDay) continue;
    const end = challengeEnd(h);
    if (end && today > end) continue;
    const [hour, minute] = h.reminderTime.split(':').map(Number);
    const content = { title: h.title, body: 'C’est le moment de ton habitude', sound: 'default' as const };
    const base = { hour, minute, channelId: CHANNEL };
    if (h.recurrence === 'daily' || h.recurrence === 'challenge') {
      await Notifications.scheduleNotificationAsync({ identifier: `${HABIT_PREFIX}${h.id}`, content, trigger: { type: T.DAILY, ...base } });
    } else if (h.recurrence === 'weekly') {
      for (const wd of h.weekdays) {
        // Ours: 0 = Monday … 6 = Sunday. Expo: 1 = Sunday … 7 = Saturday.
        await Notifications.scheduleNotificationAsync({
          identifier: `${HABIT_PREFIX}${h.id}:${wd}`, content, trigger: { type: T.WEEKLY, weekday: ((wd + 1) % 7) + 1, ...base },
        });
      }
    } else if (h.recurrence === 'monthly') {
      await Notifications.scheduleNotificationAsync({
        identifier: `${HABIT_PREFIX}${h.id}`, content, trigger: { type: T.MONTHLY, day: Math.min(h.monthDay ?? 1, 28), ...base },
      });
    }
  }
}
