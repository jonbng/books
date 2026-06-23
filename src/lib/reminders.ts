/**
 * The reading-reminder schedule — a pure, self-decaying "ladder" of one-shot
 * local notifications (DESIGN.md §5).
 *
 * Local notifications can't run logic in the background, so instead of one
 * repeating daily reminder we pre-schedule a series of one-shot notifications
 * stretching ~a year out, with gaps that widen the longer the user stays away.
 * The app re-lays this ladder from "now" every time it's opened, so:
 *
 *  - An engaged user constantly resets to day 0 and only ever sees the gentle
 *    near-term rungs (a daily nudge at their chosen time).
 *  - A user who stops opening the app is never rescheduled, so they simply ride
 *    the pre-laid ladder as it decays to monthly and tapers off — the
 *    "ease off after a month" behaviour falls out for free.
 *
 * Everything here is a pure function of its inputs (`now` is injected, no I/O)
 * so it's fully deterministic and unit-testable, mirroring src/lib/dates.ts.
 * The OS integration that consumes this lives in src/services/notifications.ts.
 */

export type ReminderPhase =
  | 'active' // week 1 — daily nudges while clearly engaged
  | 'cooling' // weeks 2–4 — easing off
  | 'dormant'; // 30+ days away — minimal, monthly

export interface ScheduledReminder {
  /** Absolute local time the notification should fire. */
  fireAt: Date;
  phase: ReminderPhase;
  title: string;
  body: string;
}

/**
 * Day offsets from the last app-open, all firing at the user's reminder time.
 * Gentle ramp-down: daily for week 1, ~every 4 days for weeks 2–4, then monthly
 * out to a year. ~24 rungs — well under iOS's ~64 pending-notification cap.
 */
const OFFSETS: readonly number[] = [
  0, 1, 2, 3, 4, 5, 6, 7, // active: daily (week 1)
  11, 15, 19, 23, 27, // cooling: ~every 4 days (weeks 2–4)
  30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330, 360, // dormant: monthly
];

function phaseFor(offset: number): ReminderPhase {
  if (offset <= 7) return 'active';
  if (offset <= 27) return 'cooling';
  return 'dormant';
}

/** Copy per phase. The active phase has a streak-aware variant. */
const COPY: Record<ReminderPhase, { title: string; body: string }[]> = {
  active: [
    { title: 'Time to read 📖', body: 'A few pages is a great start.' },
    { title: 'A few pages? 📖', body: 'Small reading habits add up fast.' },
  ],
  cooling: [
    { title: 'Your book is waiting 📚', body: 'Pick up where you left off.' },
    { title: 'Miss your story? 📖', body: 'A quiet chapter is calling.' },
  ],
  dormant: [
    { title: 'Still here when you’re ready 📚', body: 'Your books are waiting whenever you want them.' },
    { title: 'No rush 🌙', body: 'Come back to your reading any time.' },
  ],
};

const ACTIVE_STREAK_COPY: { title: string; body: string }[] = [
  { title: 'Keep your streak alive 🔥', body: 'A few pages today keeps it going.' },
  { title: 'Don’t break the chain 📖', body: 'Even one page counts toward your week.' },
];

/** Pick copy deterministically by rung index so consecutive nudges vary. */
function copyFor(phase: ReminderPhase, index: number, hasActiveStreak: boolean) {
  const pool = phase === 'active' && hasActiveStreak ? ACTIVE_STREAK_COPY : COPY[phase];
  return pool[index % pool.length];
}

/** Build a `Date` for `offset` days after `now`, at the given local time. */
function fireDate(now: Date, offset: number, hour: number, minute: number): Date {
  const d = new Date(now);
  d.setHours(hour, minute, 0, 0);
  d.setDate(d.getDate() + offset);
  return d;
}

/**
 * Build the ladder of reminders to schedule, anchored at `now`.
 *
 * - The day-0 rung (today at the reminder time) is included only when it's still
 *   in the future AND the user hasn't read today — so logging a read in the
 *   evening (which re-lays the ladder) won't nag them the same night.
 * - Any rung whose time has already passed is dropped.
 */
export function buildReminderSchedule(opts: {
  now: Date;
  hour: number;
  minute: number;
  readToday: boolean;
  hasActiveStreak: boolean;
}): ScheduledReminder[] {
  const { now, hour, minute, readToday, hasActiveStreak } = opts;
  const result: ScheduledReminder[] = [];

  OFFSETS.forEach((offset, index) => {
    if (offset === 0 && readToday) return; // already read — no nudge tonight
    const fireAt = fireDate(now, offset, hour, minute);
    if (fireAt.getTime() <= now.getTime()) return; // time already passed
    const phase = phaseFor(offset);
    const { title, body } = copyFor(phase, index, hasActiveStreak);
    result.push({ fireAt, phase, title, body });
  });

  return result;
}
