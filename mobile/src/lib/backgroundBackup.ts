// Scheduled Drive backup while the app is closed (best effort: the OS decides when tasks run,
// like WhatsApp). The app also checks on every launch / return to foreground.
// Native modules are loaded lazily and guarded: a failure here must never block the app from starting.
export const BACKUP_TASK = 'coffre-drive-backup';

/** Must run once at app start, outside any component. Never throws. */
export function defineBackupTask() {
  try {
    const TaskManager = require('expo-task-manager') as typeof import('expo-task-manager');
    const BackgroundTask = require('expo-background-task') as typeof import('expo-background-task');
    const { runScheduledBackup } = require('./drive') as typeof import('./drive');
    TaskManager.defineTask(BACKUP_TASK, async () => {
      const result = await runScheduledBackup();
      return result === 'failed' ? BackgroundTask.BackgroundTaskResult.Failed : BackgroundTask.BackgroundTaskResult.Success;
    });
  } catch (e) {
    console.warn('Tâche de sauvegarde indisponible', e);
  }
}

export async function syncBackgroundTask(enabled: boolean) {
  try {
    const TaskManager = require('expo-task-manager') as typeof import('expo-task-manager');
    const BackgroundTask = require('expo-background-task') as typeof import('expo-background-task');
    const registered = await TaskManager.isTaskRegisteredAsync(BACKUP_TASK);
    if (enabled && !registered) await BackgroundTask.registerTaskAsync(BACKUP_TASK, { minimumInterval: 6 * 60 }); // minutes
    else if (!enabled && registered) await BackgroundTask.unregisterTaskAsync(BACKUP_TASK);
  } catch {
    /* background tasks unavailable (Expo Go, emulator): the foreground check still works */
  }
}
