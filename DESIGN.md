# Reading Habit Tracker — Design & Feature Spec

> A cozy, native book-reading **habit tracker**. Not a Goodreads competitor — the goal is
> to help you read **consistently**, with shelves and stats as supporting cast.

---

## 1. Product pitch

The app exists to answer one question every day: **"Did I read today?"** — and to make
answering it feel good. Tracking, shelves, and stats all serve the habit. Reading
consistently should feel rewarding, gentle, and beautiful.

## 2. Locked decisions

| Decision | Choice |
| --- | --- |
| Platforms | iOS + Android (native). **No web.** |
| Framework | Expo SDK 56 (read versioned docs before coding) |
| Storage | **Local-first only** — on-device SQLite, fully offline, **no login/account** |
| Book data | **Open Library API** (search, covers, metadata) |
| Visual direction | **Warm & cozy** (paper/library feel, warm neutrals, soft) |
| v1 scope | Reading **habit/streaks** + **library shelves** + **stats & insights** + **reading-session timer** |

Out of scope for v1: cloud sync, social features.

The reading-session timer (pick a book → run a timer → log pages on finish) is now
in scope. A finished session advances the book's progress and auto-marks the day
read, folding its pages into the same streak/stats it would have logged manually —
the timer is a richer way to log a reading day, not a parallel system. The single
active session is persisted, so the timer survives backgrounding/relaunch.

## 3. Core loop — checkmark-first, detail-optional

- The primary action is a **single tap: "I read today"** → marks the day done.
- After marking, the user can **optionally** add detail: pages read and/or which book.
- Low friction is the priority — keeping the streak alive matters more than precise data.

## 4. The streak model (forgiving, two layers)

The whole model is built to be **forgiving** so one bad day or week never makes someone
rage-quit.

- **Weekly target:** user picks **4, 5, 6, or 7 days/week** as their goal.
- **The streak unit is the WEEK, not the day.** Hit your weekly target → the week is ✓ →
  your **week streak** grows ("8 weeks strong").
- **Within a week:** a row of **7 dots** fills in as you read — e.g. "4 of 5 days this week."
  Gives daily satisfaction inside a forgiving weekly frame.
- **Week reset:** **Monday.** New week = fresh start.

### Freezes (the vacation/exam escape hatch)

- A **freeze** covers a whole week to keep the streak intact even if you read zero days
  that week.
- **Earned:** you get **1 freeze per 2-week streak** (consistency earns the safety net).
- Applying a freeze is **automatic**: when a week's goal isn't met, a banked freeze covers
  it for you (most-recent missed week first) — no buttons, no guilt. The mechanic stays
  invisible until you look at Stats, where banked freezes are surfaced.
- _Open:_ max number of freezes you can hold at once (proposed 2–3).

**Two layers of forgiveness:** daily slack within the week + freezes for whole weeks.

## 5. Reminders & nudges

- **In scope for v1.** A daily nudge at a user-chosen time (e.g. "Time to read 📖").
- Should reinforce the habit without nagging.

## 6. The bookshelf — the showpiece

**Direction: cover-forward, standing on a shelf — modernized.** Inspired by the classic
iBooks shelf (covers on ledges, with a small progress bar baked into each cover), but
**stripped of the dated skeuomorphism**.

What we keep from the inspiration:
- Covers standing on **shelf ledges**.
- A **per-cover progress bar** (the "8% / 1%" strip) for currently-reading books — but
  cozier: a thin warm-toned fill across the bottom of the cover.

What we change (modernize):
- **No photorealistic wood.** Background is a soft **warm paper/plaster tone** (cream/oat),
  with at most a barely-there paper grain. Covers provide the color; background stays quiet.
- **Shelf ledge is a hint, not a plank** — a thin ledge with one **soft realistic
  drop-shadow** under each cover so books feel like they rest on something with weight.
  That single shadow sells the tactility; no wood grain needed.
- **Covers as objects:** rounded corners (`borderCurve: 'continuous'`), soft contact
  shadow, subtle spine-edge highlight.

Motion (where it earns "premium"):
- Subtle **parallax** as you scroll (covers drift slightly against the background).
- Books **animate in** when added: slide up onto the shelf + small settle bounce + haptic.
- Tapping a cover does a smooth **shared-element zoom** into the book detail page
  (native Apple zoom transitions).

### Open shelf questions

1. **Organization:** one continuous shelf wall vs. **grouped labeled shelves** — "Reading"
   (big covers up top), "Want to Read", "Finished". _Leaning grouped_, because the
   **Finished shelf visibly filling up is the reward** — a year of reading made physical.
2. **Cover sizing:** uniform tidy grid vs. **real-proportion covers** (chunky novel vs.
   slim novella render at slightly different sizes from Open Library dimensions; more
   characterful). _Reference uses real proportions and it's charming._

## 7. Home screen (open — needs decision)

The last big anchor. Two models:

- **A (leaning this): "Today" is home.** Opening the app shows the habit first — the "did I
  read?" check, this week's 7 dots, your current book front-and-center, the streak. The
  **Shelf is its own tab** for browsing and admiring. _Habit first, library second — matches
  the app's pitch._
- **B: The shelf is home**, with habit stuff as a banner/ring on top — if the shelf is so
  pretty it should be the first thing you see.

## 8. Cozy payoff moments (delight budget)

- Satisfying animation + haptic when you mark the day done.
- **Calendar heatmap** that fills in like a cozy quilt as you read.
- **"Finished a book"** gets a special celebration screen + the book goes on the Finished shelf.
- **Streak milestones** (e.g. 2 weeks → first freeze; longer streaks) with a small badge moment.

## 9. Stats & insights (v1)

- Books finished, pages over time, reading pace.
- Calendar heatmap of reading days.
- The growing Finished shelf doubles as a visual stat.
- _Open:_ yearly book-count goal (Goodreads-style) — include as a stat/goal?

## 10. Per-book

- Currently-reading books show **progress** (page X of Y → %) via the cover progress bar.
- **Finishing a book is a deliberate action** ("mark as finished") that triggers the
  celebration and moves it to the Finished shelf.

---

## Open questions checklist

- [ ] Max freezes held at once (proposed 2–3)
- [ ] Shelf organization: one wall vs. grouped labeled shelves (leaning grouped)
- [ ] Cover sizing: uniform grid vs. real proportions (leaning real proportions)
- [ ] Home screen: "Today" home + Shelf tab (A, leaning) vs. shelf-as-home (B)
- [ ] Yearly book-count goal in stats?

## Tech direction (provisional)

- Expo SDK 56 + Expo Router (native tabs + stacks).
- `expo-sqlite` for local storage.
- `expo-notifications` for daily reminders.
- `expo-image` for covers and SF Symbols (`source="sf:name"`).
- `react-native-reanimated` for animations; `expo-haptics` for feedback.
- Open Library API for search/covers/metadata.
