// Scheduled Drive backup while the app is closed (best effort: the OS decides when tasks run,
// like WhatsApp). The app also checks on every launch / return to foreground.
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { runScheduledBackup } from './drive';

export const BACKUP_TASK = 'coffre-drive-backup';

// Must run at app start, outside any component.
TaskManager.defineTask(BACKUP_TASK, async () => {
  const result = await runScheduledBackup();
  return result === 'failed' ? BackgroundTask.BackgroundTaskResult.Failed : BackgroundTask.BackgroundTaskResult.Success;
});

export async function syncBackgroundTask(enabled: boolean) {
  try {
    const registered = await TaskManager.isTaskRegisteredAsync(BACKUP_TASK);
    if (enabled && !registered) await BackgroundTask.registerTaskAsync(BACKUP_TASK, { minimumInterval: 6 * 60 }); // minutes
    else if (!enabled && registered) await BackgroundTask.unregisterTaskAsync(BACKUP_TASK);
  } catch {
    /* background tasks unavailable (Expo Go, emulator): the foreground check still works */
  }
}
