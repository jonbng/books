/**
 * Reading reminders (DESIGN.md §5) via expo-notifications.
 *
 * Rather than one repeating daily notification, we schedule a self-decaying
 * "ladder" of one-shot reminders (see src/lib/reminders.ts): daily while the
 * user is engaged, easing off to monthly the longer they stay away. The app
 * re-lays the ladder from "now" on every open, so engaged users only ever feel
 * the gentle near-term rungs while lapsed users naturally fade to silence — no
 * backend, no background tasks.
 *
 * IMPORTANT: expo-notifications throws *at import time* inside Expo Go (push was
 * removed from Expo Go in SDK 53). So we never import it statically — it's
 * dynamically imported only when notifications are actually supported (a dev
 * build or standalone app, native platform). In Expo Go / web every function
 * no-ops gracefully, so the app still runs; reminders need a development build.
 *
 * Side-effectful OS integration — not unit-tested (the ladder math is, in
 * lib/reminders.test.ts). `syncReminder` is the one entry point the app calls
 * whenever reminder settings change or the app is opened.
 */

import Constants from 'expo-constants';
// Type-only import — erased at compile time, so it never triggers the runtime
// module load that crashes Expo Go.
import type * as NotificationsModule from 'expo-notifications';

import { buildReminderSchedule } from '@/lib/reminders';

/**
 * Tags our notifications so we can find & cancel just ours. (Kept as
 * 'daily-reminder' so upgrades also clean up the old repeating reminder.)
 */
const REMINDER_KIND = 'daily-reminder';
const ANDROID_CHANNEL_ID = 'daily-reminder';

/** expo-notifications can't be used in Expo Go (push removed in SDK 53) or on web. */
export function isReminderSupported(): boolean {
  return Constants.executionEnvironment !== 'storeClient' && process.env.EXPO_OS !== 'web';
}

/** Lazily load expo-notifications, or null where it isn't usable. */
async function loadNotifications(): Promise<typeof NotificationsModule | null> {
  if (!isReminderSupported()) return null;
  return import('expo-notifications');
}

let handlerConfigured = false;

/** Show reminders as a banner while the app is foregrounded. Safe to call anywhere. */
export async function configureNotificationHandler(): Promise<void> {
  if (handlerConfigured) return;
  const Notifications = await loadNotifications();
  if (!Notifications) return;
  handlerConfigured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

async function ensureAndroidChannel(Notifications: typeof NotificationsModule): Promise<void> {
  if (process.env.EXPO_OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: 'Reading reminders',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

/** Ask for notification permission. Returns whether it's granted (false if unsupported). */
export async function requestPermissions(): Promise<boolean> {
  const Notifications = await loadNotifications();
  if (!Notifications) return false;
  await ensureAndroidChannel(Notifications);

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: false, allowSound: true },
    });
    status = requested.status;
  }
  return status === 'granted';
}

/** Whether notification permission is already granted. */
export async function hasPermission(): Promise<boolean> {
  const Notifications = await loadNotifications();
  if (!Notifications) return false;
  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted';
}

/** Cancel all of our reminders (leaves any other notifications untouched). */
export async function cancelReminders(): Promise<void> {
  const Notifications = await loadNotifications();
  if (!Notifications) return;
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => n.content.data?.kind === REMINDER_KIND)
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier))
  );
}

/**
 * (Re)lay the decaying reminder ladder from "now". Replaces any existing
 * reminders. The ladder shape (offsets, phases, copy) is pure — see
 * src/lib/reminders.ts; this just turns each rung into a one-shot DATE trigger.
 */
export async function scheduleReminderLadder(opts: {
  hour: number;
  minute: number;
  readToday: boolean;
  hasActiveStreak: boolean;
}): Promise<void> {
  const Notifications = await loadNotifications();
  if (!Notifications) return;
  await ensureAndroidChannel(Notifications);
  await cancelReminders();

  const schedule = buildReminderSchedule({ now: new Date(), ...opts });
  for (const rung of schedule) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: rung.title,
        body: rung.body,
        data: { kind: REMINDER_KIND },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: rung.fireAt,
        channelId: ANDROID_CHANNEL_ID,
      },
    });
  }
}

/**
 * Reconcile the OS schedule with the user's reminder settings and current
 * engagement. Called whenever reminder settings change AND whenever the app is
 * opened (re-laying the ladder from now resets the decay clock). Requests
 * permission when turning the reminder on. Returns whether reminders are active
 * (false when unsupported, or the user turned it on but denied permission).
 */
export async function syncReminder(settings: {
  reminderEnabled: boolean;
  reminderHour: number;
  reminderMinute: number;
  readToday: boolean;
  hasActiveStreak: boolean;
}): Promise<boolean> {
  if (!isReminderSupported()) return false;
  if (!settings.reminderEnabled) {
    await cancelReminders();
    return false;
  }
  const granted = (await hasPermission()) || (await requestPermissions());
  if (!granted) {
    await cancelReminders();
    return false;
  }
  await scheduleReminderLadder({
    hour: settings.reminderHour,
    minute: settings.reminderMinute,
    readToday: settings.readToday,
    hasActiveStreak: settings.hasActiveStreak,
  });
  return true;
}
