/**
 * User preferences — a single SQLite row (id = 1) exposed as a typed object.
 *
 * `updateSettings` takes a partial patch so callers touch only what they change.
 * Adding a preference = add a column (migration) + a field here + a COLUMN entry.
 */

import type { ColorSchemePreference } from '@/constants/theme';

import { getDb } from './database.ts';

export interface Settings {
  /** Weekly goal: 4, 5, 6, or 7 days/week. */
  weeklyTarget: number;
  /** Most freezes the user may hold at once. */
  maxFreezes: number;
  /** Whether the daily reminder is on. */
  reminderEnabled: boolean;
  /** Reminder time, local 24h. */
  reminderHour: number;
  reminderMinute: number;
  /** Optional yearly book-count goal (DESIGN.md §9). */
  yearlyGoal: number | null;
  /** Lifetime freezes earned (monotonic — see lib/freezes.ts). */
  freezesEarned: number;
  /** Highest streak length already credited toward earning freezes. */
  freezeCreditStreak: number;
  /** Whether the user has finished the first-run onboarding flow. */
  onboardingComplete: boolean;
  /** Theme choice: follow the OS, or force light / dark. */
  themePreference: ColorSchemePreference;
}

interface SettingsRow {
  weekly_target: number;
  max_freezes: number;
  reminder_enabled: number;
  reminder_hour: number;
  reminder_minute: number;
  yearly_goal: number | null;
  freezes_earned: number;
  freeze_credit_streak: number;
  onboarding_complete: number;
  theme_preference: string;
}

const COLUMN: Record<keyof Settings, string> = {
  weeklyTarget: 'weekly_target',
  maxFreezes: 'max_freezes',
  reminderEnabled: 'reminder_enabled',
  reminderHour: 'reminder_hour',
  reminderMinute: 'reminder_minute',
  yearlyGoal: 'yearly_goal',
  freezesEarned: 'freezes_earned',
  freezeCreditStreak: 'freeze_credit_streak',
  onboardingComplete: 'onboarding_complete',
  themePreference: 'theme_preference',
};

function fromRow(row: SettingsRow): Settings {
  return {
    weeklyTarget: row.weekly_target,
    maxFreezes: row.max_freezes,
    reminderEnabled: row.reminder_enabled === 1,
    reminderHour: row.reminder_hour,
    reminderMinute: row.reminder_minute,
    yearlyGoal: row.yearly_goal,
    freezesEarned: row.freezes_earned,
    freezeCreditStreak: row.freeze_credit_streak,
    onboardingComplete: row.onboarding_complete === 1,
    themePreference: row.theme_preference as ColorSchemePreference,
  };
}

/** SQLite stores booleans as 0/1; strings/numbers pass through. */
function toDbValue(key: keyof Settings, value: Settings[keyof Settings]): number | string | null {
  if (key === 'reminderEnabled' || key === 'onboardingComplete') return value ? 1 : 0;
  return value as number | string | null;
}

export async function getSettings(): Promise<Settings> {
  const db = await getDb();
  const row = await db.getFirstAsync<SettingsRow>(
    `SELECT weekly_target, max_freezes, reminder_enabled, reminder_hour, reminder_minute,
            yearly_goal, freezes_earned, freeze_credit_streak, onboarding_complete,
            theme_preference
     FROM settings WHERE id = 1;`
  );
  if (!row) throw new Error('settings row missing — migrations did not run');
  return fromRow(row);
}

/** Update one or more preferences. */
export async function updateSettings(patch: Partial<Settings>): Promise<void> {
  const keys = Object.keys(patch) as (keyof Settings)[];
  if (keys.length === 0) return;

  const db = await getDb();
  const assignments = keys.map((k) => `${COLUMN[k]} = ?`).join(', ');
  const values = keys.map((k) => toDbValue(k, patch[k] as Settings[keyof Settings]));
  await db.runAsync(`UPDATE settings SET ${assignments} WHERE id = 1;`, values);
}
