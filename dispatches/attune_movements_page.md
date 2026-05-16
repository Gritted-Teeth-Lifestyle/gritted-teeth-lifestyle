# Attune Movements page (new) — Worker A (GTL 1)

**Target:** GTL 1 (`/c/Users/Jordan/gtl-1/` on `gtl1`). Branch: `dev`. Dev server: http://localhost:3001.

**Source-of-truth docs (read first; both live alongside this spec):**
- Plan: `dispatches/2026-05-02-001-feat-attune-exercises-page-plan.md`
- Brainstorm: `dispatches/2026-05-02-gtl-exercise-selection-requirements.md`

You own the **destination page**. The other two workers (Worker B on GTL 2, Worker C on GTL 3) are building the entry button and the log-set empty-day handler against the data and components you ship. Your first commit must land the shared store + picker shape so they can integrate via `git pull origin dev` (their auto-pull loop runs every 30s).

## Scope (yours)

Plan **Units 1–5** in full, plus the page-side parts of Unit 6:
- Calendar surface + attunement state model
- Day cell tiered rendering + completed-day lock
- Picker bottom sheet + multi-day target selector
- Chip actions: Copy, Delete, Replace + 3-way cascade modal
- Drag-and-drop with rest-day and cross-muscle prompts
- Auto-attune all button (page-side)
- Exit guard dialog (page-side)
- First-time-user instruction popup (page-side)

## Out of scope (explicitly NOT yours)

- The entry button on the schedule page (Worker B / GTL 2 owns).
- The month-kanji watermark restyling (Worker B / GTL 2 owns).
- The log-set / active-day screen modifications for empty-day picker (Worker C / GTL 3 owns).

## Step 1 — Land the shared interface FIRST (before any UI)

Land a single small commit that defines the attunement store and exports the Picker component shape so workers B and C can pull and integrate. This unblocks them.

**Create:** `src/state/attunement.ts` (or matching GTL state-management convention — mirror whatever the schedule/CARVE page uses; if Zustand, use that; if React Query + something, use that).

Define:
- `SetChip = { id: string, exerciseId: string, addedAt: Date }`
- `DayAttunement = { chips: SetChip[], completedAt?: Date }`
- Store keyed by `dayId`: `Record<string, DayAttunement>`
- Exported actions (stubbed initially; implement as you build subsequent units): `addChip`, `duplicateChip`, `deleteChip`, `replaceExercise(scope: 'chip' | 'day' | 'cycle', ...)`, `moveChip`, `convertRestDay`, `addMuscleToDay`, `autoAttuneAll`
- Selectors: `chipsForDay(dayId)`, `emptyDayCount()`, `isDayLocked(dayId)`

**Create:** `src/components/attune/PickerSheet.tsx` — at least the public component signature and a stub render. Worker C will import this for the log-set in-the-moment picker. Props it must accept:
- `sourceDayId: string`
- `mode: 'attune' | 'in-the-moment' | 'replace'`  (attune mode shows multi-day target; in-the-moment and replace do not)
- `onConfirm: (selectedDayIds: string[], exerciseId: string) => void`
- `onClose: () => void`

Commit message: `Attune: shared attunement store + PickerSheet stub for cross-worker integration`

Push to `origin/dev` immediately so Workers B and C can pull.

## Step 2 — Page route + calendar surface (Plan Unit 1)

Create the page route. Mirror the existing schedule/CARVE page's route and layout pattern.

- Page at `src/app/attune/page.tsx` (verify against actual GTL routing — if it uses `pages/` or a different convention, adapt).
- Wrap calendar in `<TransformWrapper>` from `react-zoom-pan-pinch`. Fit-to-viewport on mount so all carved days fit at min zoom.
- Calendar grid keyed by carved day index. Reads carved days from the same source-of-truth the schedule page writes to.
- Mobile-first: viewport ≤ 390×844. Desktop is not a target.

Install `react-zoom-pan-pinch` if not already in the GTL dependencies.

## Step 3 — Day cells with tiered zoom rendering (Plan Unit 2)

`DayCell` and `SetChip` components. Render branches via `zoomTier`:
- **Far zoom** (whole cycle visible): muscle kanji + numeric chip-count badge. No chip text.
- **Mid zoom**: first 2–3 chips truncated + `+N more`.
- **Near zoom**: full sortable chip stack with drag handles.

Completed days (`completedAt != null`) render dimmed with a lock badge; chip operations disabled (`pointer-events: none` on the chip stack).

## Step 4 — Picker sheet with multi-day target selector (Plan Unit 3)

Bottom-sheet modal with:
- Search input following the iOS PWA keyboard recipe (set `inputMode`, `enterKeyHint`, parent form `action`+`method`, plus an explicit `input.click()` after mount). This summons the soft keyboard reliably in iOS PWA standalone — verify on real device.
- Scrollable exercise list filtered to the source day's muscle(s) — picker is **muscle-locked**.
- Multi-day target selector: horizontal row of day-chips above the list, each toggleable. Source day pre-selected and non-removable. Other days appear only if their muscle matches the source day's muscle (muscle-lock parity).
- Tap exercise → highlights as "selected" but doesn't commit. Confirm button at the bottom commits: one set chip per selected target day.
- After confirm → picker auto-closes.

## Step 5 — Chip actions + cascade replace (Plan Unit 4)

Long-press chip → `ChipActionMenu` with three options:
- **Copy** — duplicates the chip in place; new chip with fresh UUID inserted immediately below the source on the same day.
- **Delete** — removes only that chip.
- **Replace** — opens picker in `mode='replace'` (no multi-day selector). After picking new exercise, opens `ReplaceCascadeModal` with three buttons:
  - "Just this chip"
  - "All [exercise] sets on this day"
  - "All [exercise] sets in this cycle"

Replace cascade actions are **atomic** — single store update. No partial state on failure.

## Step 6 — Drag-and-drop with prompts (Plan Unit 5)

Wrap the calendar in `<DndContext>` from `@dnd-kit/core`. Install `@dnd-kit/core` and `@dnd-kit/sortable` if not already present.

- `PointerSensor` configured `activationConstraint: { distance: 8 }` so a tap-without-drag still routes to the picker.
- On drag start: set `attunementStore.isChipDragging = true` → `<TransformWrapper>` reads this and disables panning (`panning.disabled` toggled).
- Drag is a **MOVE** — chip leaves source day, lands on destination day. Never a copy. Copy lives in the chip action menu.
- Drop logic:
  - Same-muscle workout day → silent move.
  - Rest day → modal: "Convert this rest day to [muscle] day?" Confirm → `convertRestDay` then move. Cancel → no-op.
  - Cross-muscle workout day → modal: "Add [muscle] to this day's training?" Confirm → `addMuscleToDay` then move. Cancel → no-op.
- Drop on a locked completed day → reject with shake/toast, chip returns to source.

## Step 7 — Page polish: Auto-attune all, exit guard, first-time popup (Plan Unit 6 page-side)

- **AutoAttuneButton** — prominent on Attune page while every day has zero chips. After any chip exists anywhere, dismiss/demote. Calls `autoAttuneAll()` writing one canonical exercise per muscle-day. If GTL's express path has an auto-pick function, share it; otherwise write a thin deterministic selector (one canonical exercise per muscle).
- **ExitGuardDialog** — intercepts back navigation (browser back, header back, in-SPA route changes). If `emptyDayCount() > 0`, prompt: "You have N workout day(s) with no exercises attuned. Are you sure you want to leave?" Confirm → proceed; Cancel → stay.
- **FirstTimeInstructionPopup** — on Attune page mount, check persistent flag `attuneOnboardingSeen` (use whatever local-preferences pattern GTL already has — localStorage, IDB, etc.). If unset, show modal with copy (verbatim, lowercase): *"attune your movements to specific days. copy, move, and replace movements at will."* Dismiss → set flag forever. Globally one-shot, not per-cycle.

## Coordination with Workers B and C

- **Worker B** (GTL 2) needs the page route to exist (even as a stub) so their button has a navigation target. Step 2 lands this.
- **Worker C** (GTL 3) needs the attunement store + PickerSheet component. Step 1 lands the store; PickerSheet shape is stable from Step 1; the in-the-moment picker uses `mode='in-the-moment'`.
- After each step, push to `origin/dev`. Workers B and C auto-pull every 30s.

## DO NOT

- Touch the schedule page or its month kanji (Worker B's lane).
- Touch the log-set / active-day / workout screen (Worker C's lane).
- Touch the express forge cycle path or its auto-pick logic.
- Touch the curated exercise library contents — assume `lib/exerciseLibrary` (or matching GTL convention) exposes a query function `exercisesByMuscle(muscle): Exercise[]`.
- Implement reorder UX on the Attune page itself — Attune is placement-only (R10a). Reorder lives on the workout/log-set screen.
- Pick a different drag-drop or pan-zoom library — use `@dnd-kit` and `react-zoom-pan-pinch` as specified.
- Skip the iOS PWA keyboard recipe on the picker search input.

## Verify

Test on iPhone-sized viewport (~390×844) in real device or DevTools mobile emulation. For PWA-specific behavior, verify on a real iPhone in standalone mode.

1. Pinch-zoom the calendar across all three rendering tiers — kanji+count, truncated stack, full chips.
2. Tap a day → picker opens muscle-locked. Search filters list. Multi-day selector lets you pick additional matching-muscle days. Confirm places one chip per selected day.
3. Long-press chip → action menu. Copy duplicates in place. Delete removes one. Replace → picker → cascade modal, all three scopes work.
4. Drag chip onto another matching-muscle day → silent move. Onto rest day → prompt. Onto different-muscle day → prompt. Onto locked completed day → rejected.
5. Auto-attune all on empty cycle → every day gets one chip in one tap.
6. Try to leave with empty workout days → exit guard fires with correct count.
7. First-ever entry → instruction popup appears with verbatim copy. Dismiss → never reappears.
8. iOS PWA: search input summons soft keyboard reliably.

## Report

- Final commit hash on `origin/dev`.
- Three screenshots: (a) calendar at far zoom showing kanji+count, (b) picker open with multi-day selector, (c) drag-drop in progress (chip mid-flight).
- Confirmation that `attunementStore` and `PickerSheet` are exported and other workers' integrations work after pulling.

## Commits

Push to `origin/dev` after each meaningful step (Step 1 separately so B and C can pull, then subsequent steps as you go).
