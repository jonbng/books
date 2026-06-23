# Reading

A cozy, native **reading habit tracker** — built to answer one question every day:
_"Did I read today?"_ See [DESIGN.md](./DESIGN.md) for the full product spec.

- **Platforms:** iOS + Android (Expo SDK 56). No web focus.
- **Storage:** local-first, on-device SQLite. Fully offline, no account.
- **Core loop:** one tap to mark the day, with optional detail.
- **Streak model:** forgiving and week-based (see DESIGN.md §4).

## Getting started

```bash
npm install
npm start        # then open in Expo Go (or a dev build)
```

In development the database is seeded with a couple of weeks of demo reading so
the streak UI has something to show. To start clean, delete the app's data
(reinstall in the simulator) — seeding only runs when the reading log is empty.

## Project layout

```
src/
  app/                 Expo Router routes (file-based)
    _layout.tsx        Tabs + ReadingStoreProvider
    index.tsx          Today (home): the "I read today" loop
    shelf.tsx          Bookshelf (placeholder — Phase 3)
    stats.tsx          Stats & insights (placeholder — Phase 4)
  lib/
    dates.ts           Pure date helpers (Monday-based weeks, UTC)
    streak.ts          Pure streak engine (week status, streak, freezes)
    streak.test.ts     Unit tests (run with `npm test`)
  db/
    database.ts        SQLite connection + migrations
    reading-repo.ts    Reading-log data access + demo seed
  hooks/
    use-reading-store.tsx  Reactive bridge: SQLite → streak → UI
```

## Tests

The streak engine is pure and unit-tested with the Node test runner (no Jest):

```bash
npm test
```
