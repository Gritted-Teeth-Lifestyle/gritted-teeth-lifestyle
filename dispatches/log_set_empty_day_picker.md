# Log-set / active-day empty-day picker — Worker C (GTL 3)

**Target:** GTL 3 (`/c/Users/Jordan/gtl-3/` on `gtl3`). Branch: `dev`. Dev server: http://localhost:3003.

**Source-of-truth docs (read first; both live alongside this spec):**
- Plan: `dispatches/2026-05-02-001-feat-attune-exercises-page-plan.md`
- Brainstorm: `dispatches/2026-05-02-gtl-exercise-selection-requirements.md` (R17, R18)

You own the **active-day / log-set screen** modification. When the user arrives at a workout day with **zero attuned exercises**, the screen surfaces an in-the-moment exercise picker. This is the bridge between the Attune Movements feature (Worker A on GTL 1) and the existing log-set flow.

Auto-pull loop is running — Worker A's first commit (the shared attunement store + PickerSheet stub) will appear on `origin/dev` shortly. You wait for that, then build against it.

## Scope (yours)

1. Read the new attunement store (Worker A's `src/state/attunement.ts`) from the active-day / log-set screen.
2. If the active day has zero chips attuned (`chipsForDay(activeDayId).length === 0`) AND the day has at least one muscle assigned, surface the **in-the-moment picker** automatically on screen entry.
3. Picker is **muscle-locked to today's muscle(s)** (R6 / R18 parity).
4. After the user picks an exercise (single chip), the chip is added to today's attunement and the log-set flow proceeds normally.

## Out of scope (NOT yours)

- The Attune Movements page itself (Worker A / GTL 1).
- The schedule-page entry button (Worker B / GTL 2).
- Existing log-set behavior for days that already have chips attuned — leave that alone. Only the empty-day arrival case is new.
- Set / rep / weight prescription — that's a separate effort in Jordan's backlog. You're only solving "no chips attuned → pick one now."

## Step 1 — Wait for Worker A's foundation

Before writing code, `git pull origin dev` and confirm:
- `src/state/attunement.ts` exists with exports `chipsForDay`, `addChip` (or equivalent), `SetChip`, `DayAttunement`.
- `src/components/attune/PickerSheet.tsx` exists and accepts `mode='in-the-moment'`.

If those aren't on `origin/dev` yet, wait — your auto-pull loop will catch them. Don't reinvent.

## Step 2 — Find the active-day / log-set screen

Locate the existing screen where the user logs sets for today's workout. This is probably named something like `app/workout/page.js`, `app/log-set/...`, or similar — search for "log set", "active day", "today's workout", or follow the navigation path from the schedule page when a workout day is tapped.

## Step 3 — Add the empty-day check

On screen mount (or when the active day's identity is established), check:

```
const chips = attunementStore.chipsForDay(activeDayId);
const hasMuscles = activeDay.muscles.length > 0;

if (chips.length === 0 && hasMuscles) {
  // open the in-the-moment picker
}
```

If chips.length is 0 but the day has no muscles assigned either, do **not** open the picker — there's no muscle to lock to. Show the existing empty-state UI (or a clear "no muscles assigned for today" message; mirror existing GTL empty-state vocabulary).

## Step 4 — Mount the picker in in-the-moment mode

Use Worker A's `PickerSheet` component:

```jsx
<PickerSheet
  sourceDayId={activeDayId}
  mode="in-the-moment"
  onConfirm={(_targetDayIds, exerciseId) => {
    attunementStore.addChip(activeDayId, exerciseId);
    setPickerOpen(false);
  }}
  onClose={() => setPickerOpen(false)}
/>
```

Notes:
- In `mode='in-the-moment'`, the picker does NOT show the multi-day target selector (only operates on today). Worker A's component handles this branch.
- The picker is muscle-locked to today's muscle(s) by passing `sourceDayId` — the picker reads the day's muscles and filters the exercise list accordingly.
- After confirm, the chip is added to today's attunement; the picker auto-closes; the rest of the log-set screen takes over.

## Step 5 — Don't double-summon

If the user dismisses the picker without picking (escape, back, swipe-down), don't re-open it on the same screen visit. Re-arriving on the screen later (navigation away and back) re-evaluates and may re-open if still empty. Track a `dismissedThisVisit` flag in component-local state.

## DO NOT

- Modify `src/state/attunement.ts` — Worker A owns it. Read-only from your side except for `addChip`.
- Modify `src/components/attune/PickerSheet.tsx` — Worker A owns it. If `mode='in-the-moment'` doesn't behave correctly, file the issue verbally with Jordan; don't patch in your worktree.
- Touch the schedule page or the Attune Movements page or any screen outside the active-day / log-set surface.
- Touch the existing log-set behavior for days that already have chips. Your change is purely additive: the empty-day case used to be unhandled or fell through to a default; now it summons the picker.
- Add muscle-prerequisite checks beyond what's specified — if the day has no muscles, fall back to existing empty-state (don't open picker, don't crash).
- Persist any state to a new store. Reuse Worker A's attunement store for the chip add.

## Verify

Mobile viewport (~390×844):

1. Schedule a planned cycle with one day, assign chest as the muscle, do **not** attune any exercises. Navigate to the active-day / log-set screen.
   - **Expected:** picker appears automatically, muscle-locked to chest, search and exercise list visible.
2. Pick bench press. Confirm. Picker closes; the log-set screen shows one bench-press chip / set ready to log.
3. Navigate away from the screen and back without logging. Picker should NOT reappear automatically (the chip is now there).
4. Reset (or new cycle): schedule a day with chest, no attunement, navigate to log-set. Dismiss the picker without picking. Stay on the empty log-set screen. Navigate away and back — picker re-evaluates and re-opens (still 0 chips).
5. Edge case: a day with no muscles assigned arrives. Picker does NOT open. Existing empty-state UI shows.
6. Edge case: a day that already has 3 chips attuned. Picker does NOT open. Normal log-set flow.

## Report

- Commit hash on `origin/dev`.
- Three screenshots: (a) empty-day arrival summoning picker, (b) post-confirm log-set screen with the chip, (c) day with no muscles assigned showing the existing empty state (no picker).
- Confirmation that you imported `PickerSheet` from Worker A's path and the `attunementStore` from Worker A's path without modifying either.

## Commit and push

Commit message: `Log-set: empty-day arrival summons in-the-moment picker (R17/R18)`

Push to `origin/dev` when done.
