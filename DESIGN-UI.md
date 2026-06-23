# UI Direction — Visual Language

> Companion to [DESIGN.md](./DESIGN.md). That doc defines *what the app does*; this one
> defines *how it looks and feels*. Locked decisions live here.

---

## 1. The one-line identity

**A well-made paperback, under glass.** Warm matte paper you can almost feel as the
content world; Apple's Liquid Glass as the chrome that floats above it. Realistic in
material, clean in composition.

The two steering words pull in opposite directions on purpose:

- **Realistic** → real materials. Paper has grain. Covers are objects with weight and a
  contact shadow. Glass refracts. Books settle when they land.
- **Super clean** → restrained composition. One accent color. Generous whitespace. Almost
  no chrome. The richness lives in the *materials*, never in clutter.

Cleanliness is not the look — it's the **discipline** that keeps the cozy realism from
sliding into kitsch.

---

## 2. The governing rule: two planes

> **If it scrolls, it's paper. If it floats, it's glass.**

| Plane | Material | What lives here |
| --- | --- | --- |
| **Content** (the world) | Warm matte paper — grain, terracotta, Fraunces serif, real book covers, warm layered shadows | The shelf, covers, the heatmap quilt, stats, the day-mark hero — everything that scrolls |
| **Chrome** (floats above) | Liquid Glass — refracts and warms from the paper beneath it | Tab bar, stack headers, add-book action, the "today" accessory pill, sheets, context menus |

This matches how Apple intends Liquid Glass — the functional layer floating *over* content,
never the content itself. Following the platform and following the cozy vision point the
same way.

### Why the two materials need each other

Liquid Glass has no inherent color — it **refracts whatever is beneath it**. Over a sterile
white app it looks cold and generic. Over this oat-and-terracotta world it picks up the warm
tones and becomes *warm glass*. The paper realism underneath is exactly what gives the glass
its character. They aren't a compromise; the paper is what makes the glass ours.

### Glass discipline (keeps it clean)

- **One glass layer per region.** Never glass-on-glass — muddy, and a real perf cost.
- **Glass only ever hovers and travels with you.** Paper cards sit *in* the page; glass
  floats *over* it.
- **Glass stays quiet and mostly empty.** It's chrome, not content.
- Always guard with `isLiquidGlassAvailable()` and fall back to `BlurView`
  (`tint="systemMaterial"`) on < iOS 26.

---

## 3. Material system

### Color — warm, one accent (terracotta / clay)

| Token | Value | Use |
| --- | --- | --- |
| `paper` | `#F4EEE2` (oat) | App background, the content plane |
| `paperDeep` | ~2–4% darker than `paper` | Bottom of the page gradient (implies light from above) |
| `ink` | `#2E2A24` (warm near-black) | Primary text. **Never pure black.** |
| `inkSoft` | warm brown | Secondary text, labels |
| `clay` | `~#C0694A` (terracotta) | The single accent — progress fills, streaks, heatmap |
| `clayDeep` | deeper terracotta | Heatmap high-intensity end, pressed accent |

One accent, zero competition. Book covers provide all other color in the app.

### Texture (lean physical — paper plane only)

- **Grain** lives on the background plane only, low opacity. Type and numbers stay razor
  crisp *on top* — never embossed into texture, never letterpressed.
- **Whisper gradient** on the page: 2–4% luminance shift, lighter top → slightly deeper
  bottom. Implies light; never a visible band.

### Shadows — warm, never gray

- Every shadow is **warm-tinted**, e.g. `rgba(60, 40, 25, …)`, soft, one key light from
  the top. Gray shadows on warm paper are the #1 tell of a cheap cozy app.
- **Layer** multiple transparent shadows for natural depth; shadow size scales with
  elevation on a consistent ramp.
- Prefer **shadows over borders**. Hard 1px borders are banned on the paper plane.
- Use `boxShadow` style prop (never legacy RN `shadow*`/`elevation`).
- Book covers get a subtle low-opacity **outline** (`rgba(0,0,0,0.1)` light /
  `rgba(255,255,255,0.1)` dark — pure black/white, never tinted) so edges read cleanly.

### Radius

- `borderCurve: 'continuous'` on every rounded corner (except true capsules).
- **Concentric radius**: inner radius = outer radius − padding. Mismatched nested radii is
  the most common thing that makes UI feel "off."

---

## 4. Typography — serif-forward, literary

The serif carries the emotional weight; sans handles small functional labels.

- **Display / titles / big numbers → Fraunces.** Variable serif, optical sizing, soft
  literary warmth, tabular numerals for the streak counter. This is the app's face.
  - Fallback / safer native option: Apple **New York** (free, native, tabular).
- **Small UI labels → SF** (or Inter). Section captions, metadata, buttons.
- Counters and any updating numbers: `fontVariant: ['tabular-nums']` to prevent layout
  shift.
- Headings: `text-wrap: balance` equivalent (keep lines even). Leave optical sizing auto.
- Never faux-bold/italic a weight the font doesn't have.

Personality in practice: a small sans label ("THIS WEEK") sitting above a large Fraunces
statement ("8 weeks strong").

---

## 5. Motion language

One personality everywhere (cohesion is what makes it feel premium): **calm, slightly slow,
soft-settling** — not snappy-corporate.

- **House easing:** iOS drawer curve `cubic-bezier(0.32, 0.72, 0, 1)`.
- **Springs** for anything you touch, drag, or that should feel alive — gentle,
  `bounce: 0.15–0.2`. Springs (not easing) for overshoot-and-settle, and because they stay
  interruptible.
- **Only animate `transform` and `opacity`** (GPU; skips layout/paint).
- **Duration discipline:** press/hover 120–180ms, small state 180–260ms, user-initiated
  max ~300ms. Fix a slow feel with shorter duration, not a different curve.
- **Ration by frequency:** never animate tab switches or anything done dozens of times a
  day. Spend the delight budget on rare moments.
- **Scale on press** `scale(0.96)` for tactile feedback (never below 0.95).
- **Stagger** list/shelf entrances 30–50ms per item; exits softer than enters.
- **Haptics** (iOS, conditional) on exactly three moments: day-mark, book-add, finish.

---

## 6. The earned realness moments (delight budget)

The paper plane is mostly calm. Tactility concentrates in four places — each earns its
weight because everything around it is restrained:

1. **The shelf** — covers as real objects: contact shadow, slight scroll parallax, a
   settle-bounce + haptic when a book is added.
2. **Marking the day** — the most-repeated action and the emotional core. A tactile *paper*
   element (not glass), pressed with a soft spring + haptic, a dot filling with a settle.
3. **Finishing a book** — the rare celebration; spend the whole budget. Cover lifts off,
   flies to the Finished shelf, warm terracotta glow, a real haptic thunk, Fraunces
   "Finished." and the book count ticks up.
4. **The heatmap** — a warm quilt that fills clay → deep terracotta as you read, not a chart.

Guardrail: *if a detail doesn't make the app feel more like a physical object, it makes it
feel more like a website — cut it.*

---

## 7. Information architecture (page map)

IA is designed around **moments of use**, not a feature list. The shape: one screen owns
the ~90% case (the daily check-in) and must be perfect; everything else is secondary.

| Moment | Frequency | Need |
| --- | --- | --- |
| Daily check-in — "did I read?" | ~daily, 90% of opens | Mark done, see streak survive, leave happy |
| Browse / admire the library | few × week | See covers, feel the collection grow |
| Add a book | occasional | Search, add to a shelf |
| Log progress / finish a book | periodic | Update pages, the finish celebration |
| Reflect — "how am I doing?" | weekly-ish | Heatmap, streak, books read |
| Configure | rare | Weekly target, reminders, freezes |

```
TABS (3 — keep the spine tiny so the daily action is unmissable)
  Today    ← home, the 90% screen
  Shelf    ← the showpiece library
  Stats    ← reflection / the quilt

NOT TABS (actions & pushed screens — a tab is a place you return to, not an action)
  Add book        → glass formSheet (Open Library search)
  Book detail     → pushed via Apple Zoom from a cover
  Log detail      → light sheet after check-in (optional)
  Settings        → header button (rare = not a tab)
  Celebrations    → overlays, not pages (finish, milestone, freeze earned)
  Onboarding      → first-run only
```

Add / Settings / celebrations are deliberately **not** tabs — a permanent slot for a
30-second-a-week job would dilute the habit focus.

---

## 7a. Per-screen

### Today (home) — the screen that has to be perfect

Paper world scrolling under glass chrome. Content in strict priority order
(serial-position — most important first *and* anchored last):

1. **Check-in hero** — *"I read today."* One tap, the reason the app exists. Tactile
   *paper* element (not glass), spring + haptic, a dot fills. They can leave right after.
2. **This week** — 7 dots, "4 of 5 days this week." Goal-gradient + Zeigarnik (an
   incomplete row pulls completion).
3. **The streak** — "8 weeks strong," big Fraunces. The thing being *protected* — make it
   distinct (Von Restorff).
4. **Currently reading** — compact strip of active book(s) with progress ("day 4 of *The
   Overstory*"). Tap → log pages / open detail. *Lives here to close the loop between "I
   read" and "…this."*
5. **Mini month heatmap** — a glanceable taste; full quilt is in Stats (progressive
   disclosure).
6. **Glass `BottomAccessory` pill** above the tab bar — *"Did you read today? · day 4 of
   The Overstory"* — always-present gentle nudge that warms from the paper below.

**Core loop = checkmark-first, detail-optional:** tap → confirmed instantly → *then* a
gentle "add detail?" reveal (pages / which book) that never blocks the checkmark.

**States to design (most apps get these wrong):**
- **Already marked today** → hero becomes a satisfied "You read today ✓" + "log more
  pages," never a dead button.
- **Week missed** → no UI at all: a banked freeze covers it **automatically** (most-recent
  missed week first), so a bad week never breaks the streak. The mechanic is invisible here;
  banked freezes are only surfaced (passively) in Stats.
- **First run / empty** → pick weekly goal, add a first book.
- **Milestone just hit** → celebration surfaces here.

### Shelf (tab) — the showpiece

- Grouped, labeled: **Reading**, **Want to Read**, **Finished** — each a real **3D shelf**:
  books stand face-out on a **dimensional ledge** (lit top surface + shadowed front face)
  that runs **full-bleed across the screen** and just sits emptier when there are few
  books — it never shrinks to fit. It grows and scrolls horizontally once books overflow.
- Books read as objects: a slight **perspective tilt**, a **page-edge** for thickness, an
  organic per-book **lean**, and a **grounding contact shadow** so each rests with weight.
- **Real-proportion covers** (chunky novel vs. slim novella from Open Library dimensions).
  Reading shows a clay progress strip; Finished is captionless (the wall of spines is the
  reward). Fraunces section headers above each shelf.
- Tap a cover → **book detail** (push; Apple Zoom on iOS later). **Add book** action lives
  here (the natural "I want a new book" place).
- **Empty states do real work:** "Your Finished shelf is empty — finish your first book to
  start filling it." Minimal sort/filter in v1 (recently-added default).

### Stats (tab) — reflection, the quilt

The journal you flip through, not a dashboard. Few metrics that matter; no vanity ones.

- **Calendar heatmap** — centerpiece, the cozy quilt filling clay → deep terracotta.
- **Streak history** — current + longest week-streak.
- **Books finished** — this year / all time; mini Finished shelf links back.
- **Pages over time** — reading pace / pages-per-week.
- **Yearly book goal** — *always on*, shown as a soft terracotta goal-gradient ring.
  Framed **ahead / on-track, never "behind" in red** ("18 of 30 · on track for 31") so it
  motivates without the pace-pressure sting that fights the forgiving ethos.

### Book detail (pushed)

- **Apple Zoom** shared-element transition from the tapped cover (`Link.AppleZoom`, iOS 18+).
- Paper page: big cover, Fraunces title + author, metadata, **progress** (page X of Y →
  clay bar, editable), status control (Want → Reading → Finished), **"Mark as finished"**
  (deliberate → celebration), remove. No notes/reviews in v1 — this is a tracker, not Goodreads.

### Add a book (glass sheet)

- `formSheet` with `contentStyle: { backgroundColor: 'transparent' }` → Open Library search
  floats up as a **warm-glass sheet** over the shelf. Tap a result → add to a shelf
  (default Want to Read, or "Start reading now" → Reading).

### Settings / Onboarding / Celebrations

- **Settings** (pushed paper screen): **weekly goal** (4/5/6/7 — its only home; not on
  Today), **daily reminder** (on/off + time), **yearly goal** (on/off + count), and a note
  that freezes are automatic and data lives on-device. Reached via a "Settings" link on Today.
- **Onboarding:** 2–3 light first-run steps (weekly goal, optional first book, optional
  reminder) — paper plane + Fraunces, in the app's voice.
- **Celebrations** are overlays, not pages: book finished, streak milestone (peak-end —
  always end on a clear win).

---

## 8. Expo / iOS implementation notes (SDK 56)

- **Tab bar:** `NativeTabs` from `expo-router/unstable-native-tabs` — auto Liquid Glass on
  iOS 26. `minimizeBehavior="onScrollDown"`. Search tab last with `role="search"`.
- **Glass surfaces:** `GlassView` from `expo-glass-effect`; `isInteractive` for pressables.
  Guard with `isLiquidGlassAvailable()`, fall back to `expo-blur` `BlurView`
  (`tint="systemMaterial"`, `intensity` 50–100, `overflow: 'hidden'` for radius).
- **Today nudge:** `NativeTabs.BottomAccessory` (two instances render — keep state external).
- **Glass sheets:** `presentation: 'formSheet'` + transparent `contentStyle`,
  `sheetGrabberVisible`, `sheetAllowedDetents`.
- **Stack headers:** transparent, large titles, `headerShadowVisible: false`,
  `headerBlurEffect: 'none'`, color via `PlatformColor('label')`.
- **Covers + SF Symbols:** `expo-image` (`source="sf:name"` for symbols).
- **Motion:** `react-native-reanimated`; **haptics:** `expo-haptics` (iOS, conditional).
- **Zoom:** `Link.AppleZoom` for cover → detail.
- Account for safe area via `contentInsetAdjustmentBehavior="automatic"` on the first
  ScrollView/FlatList — not `SafeAreaView`.

---

## 9. Decisions locked

| Question | Decision |
| --- | --- |
| Home screen | **"Today" is home** (model A); Shelf is its own tab |
| Shelf organization | **Grouped labeled shelves** (Reading / Want to Read / Finished) |
| Cover sizing | **Real proportions** from Open Library dimensions |
| Typography | **Serif-forward, literary** — Fraunces display + SF labels |
| Accent color | **Terracotta / clay** on oat paper, single accent |
| Realness dial | **Lean physical** — scoped to the paper plane only |
| Material architecture | **Two planes**: paper content, Liquid Glass chrome |
| Tab spine | **3 tabs**: Today · Shelf · Stats. Add/Settings are actions, not tabs |
| Current reading | **On Today** (compact strip) as well as the Shelf |
| Yearly goal | **Always on** in Stats — soft progress, ahead/on-track framing, never "behind" |
| Freezes | **Automatic** — banked freezes cover a missed week (most-recent first); no manual control |
| Weekly goal home | **Settings only** (not on Today) |
| Shelf realism | **Full 3D shelf** — books lean back on a full-bleed dimensional ledge, page-edge thickness, grounding shadow |
| Platform | **Mobile only, no web** — Android-first dev build; iOS glass + Apple Zoom are a later pass |

### Still open (from DESIGN.md, not UI-blocking)

- Max freezes held at once (proposed 2–3)

---

## 10. Build status (what's implemented vs. deferred)

**Built (Android-first, mobile only):** design tokens + Fraunces (`@expo-google-fonts/fraunces`)
+ motion in `constants/theme.ts`; `PaperBackground`/`Paper`, `BookCover`, `ScreenHeader`,
`shelf-scene` (3D shelf) primitives; **Today** (tactile day-mark hero, week dots, streak,
currently-reading strip, Settings link); **Shelf** (3 real 3D shelves, Open Library search/add);
**Stats** (heatmap, yearly-goal progress, streak/pages, banked-freeze note); **book/[id]**
detail (progress steppers, shelf moves, finish, delete); **Settings** (weekly/reminder/yearly);
onboarding restyled to the paper/Fraunces voice. Auto-freeze lives in `lib/freezes.ts`
(`selectAutoFreezeWeeks`, tested) + `use-app-data` reload.

**Cover → detail transition:** the genuine shared-element morph (`Link.AppleZoom`) is **iOS
18+ only** — Reanimated's `sharedTransitionTag` is experimental/flaky on the New Architecture,
and the old shared-element libs don't support New Arch, so there's no clean cross-platform
"real" version. **Android ships a decent fallback** (built): a cross-fade into the detail
screen + the hero **cover springing up** with the title/author rising in behind it. Apple Zoom
is added in the iOS pass.

**Deferred to an iOS pass** (needs a Mac / iOS 26 device): Liquid Glass surfaces +
`BottomAccessory` "did you read today?" pill, `Link.AppleZoom` cover→detail morph, add-book as
a glass `formSheet`, paper grain texture, and the finish/milestone celebration overlays. On
Android the chrome plane is the native Material 3 tab bar.
