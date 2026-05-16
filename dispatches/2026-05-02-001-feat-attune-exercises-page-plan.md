---
title: "feat: GTL Attune Exercises Page"
type: feat
status: active
date: 2026-05-02
origin: docs/brainstorms/2026-05-02-gtl-exercise-selection-requirements.md
---

# feat: GTL Attune Exercises Page

**Target repo:** `gritted-teeth-lifestyle` (Gritted-Teeth-Lifestyle org). This plan was authored from a separate brainstorming workspace and was not able to inspect the GTL repo directly. All file paths are repo-relative and follow common Next.js conventions; the implementing worker should mirror sibling features (e.g., CARVE screen, summary blade page) rather than treat the paths as authoritative.

## Overview

Build the **Attune Exercises page** for GTL's planned (non-express) cycle creation path. The page renders the entire training cycle as a zoomable, pannable calendar; lets the user assign exercise sets to muscle-days via a search-driven picker with multi-day targeting; supports chip-level Copy / Delete / Replace; and supports cross-day drag-and-drop with consent prompts for rest-day and cross-muscle drops. The express path is unchanged.

## Problem Frame

GTL's CARVE screen assigns muscles to days, but until now there has been no defined path from "today is chest day" to "log a set of bench press." The express forge cycle hides this with auto-pick + on-the-fly swap. The planned cycle path needs an explicit, ritual-feeling surface for the user to attune specific exercises across the cycle. (See origin: `docs/brainstorms/2026-05-02-gtl-exercise-selection-requirements.md`.)

## Requirements Trace

Carries forward all 19 requirements from the origin document:

- **R1–R4** Page surface, full-cycle calendar, zoom/pan, day-tap-opens-picker
- **R5–R8** Muscle-locked picker, search, no user-add library, multi-day target selector
- **R9–R10a** 0..N set chips per muscle-day, empty default + Auto-attune all, no Attune-side reorder
- **R11–R12** Set chip actions: Copy (in-place duplicate), Delete, Replace (with 3-way cascade scope)
- **R13** Drag chip cell-to-cell = move
- **R14–R16** Drop prompts: rest day → convert, cross-muscle → add muscle, matching-muscle → silent append
- **R17–R19** Empty workout day in-the-moment picker, muscle-lock parity, leave-with-empty-days exit confirmation
- **R20** First-time-user instruction popup (global one-shot, not per-cycle)

## Scope Boundaries

- The Express forge cycle's auto-pick/swap is **untouched**.
- The contents and tagging of the curated exercise library are out of scope here. This plan assumes a queryable library exists (or is built in parallel) keyed by muscle.
- Set / rep / weight prescription stays in the separate Log Set screen redesign effort.
- No user-added exercises, no community sync, no search ranking ML.

## Context & Research

### Relevant Code and Patterns (assumed; implementer to verify)

- **CARVE screen** — existing source of truth for cycle muscle assignments. The Attune page reads cycle days + muscle assignments from the same store CARVE writes to. New page mirrors CARVE's visual idiom (kanji, dark/red palette, ritual feel).
- **Express path's swap-on-set-screen** — visual pattern reference for Replace's "pick a different exercise" picker (same component if reusable).
- **Summary blade page** — existing precedent for full-screen, custom-gestured surface. Rotational/scaled SVG composition there is a useful precedent for zoom-pan choreography.

### Institutional Learnings (assumed; implementer to verify)

- **iOS PWA keyboard summon recipe** (`feedback_king_dispatch_via_file` / project memory) — the picker's search input must use the `input.click + inputMode + enterKeyHint + form action+method` recipe to summon the iOS soft keyboard reliably in standalone PWA mode.
- **Mobile-only viewport** — design and test at ~390×844; never a desktop layout.

### External References

- `@dnd-kit/core` + `@dnd-kit/sortable` for chip drag-and-drop with touch + pointer sensor support
- `react-zoom-pan-pinch` for the calendar pan/zoom surface
- React Query / Zustand (whichever GTL already uses) for the cycle attunement store

## Key Technical Decisions

- **`@dnd-kit` for chip DnD**, configured with a `PointerSensor` that uses `activationConstraint: { distance: 8 }` so chip-drag does not fire during pan-zoom gesture starts. Alternative considered: HTML5 DnD (rejected — poor mobile touch support); `react-dnd` (rejected — touch backend is more friction than @dnd-kit's sensor model).
- **`react-zoom-pan-pinch` for the calendar surface**, with `panning.disabled` toggled while a chip is mid-drag so the surface does not pan under the user's finger during a drop.
- **Coordinate translation handled by @dnd-kit's collision detection** rather than manually transforming pointer coordinates. Drop targets register their bounding rects post-pan; @dnd-kit's `closestCenter` works in screen space because both droppable rects and pointer position are screen-space.
- **Picker as a bottom-sheet modal** (mobile-friendly, search input within thumb reach), not a full-screen takeover. Multi-day target selector is a row of day chips at the top of the bottom sheet, populated from the visible calendar.
- **Cycle attunement state shape**: the cycle is the authoritative entity; each day has `{ muscles: Muscle[], chips: SetChip[], completedAt?: Date }`. Each `SetChip` is `{ id: UUID, exerciseId: ExerciseId, addedAt: Date }`. Deletion is a chip-array filter; reorder lives off-page.
- **Single Attune entry point on the schedule page** (R1 deferred → resolved): an **"Attune Movements"** button that sits in front of the month-kanji watermark on the schedule page. The month kanji — currently a prominent label — is demoted to a low-opacity background watermark, and the button is overlaid on top. The button is **inactive until a day on the schedule has been selected**, mirroring the activation pattern of the existing CARVE button. Tapping the button opens the Attune page rendering exactly the days the user has carved on the schedule (the carved days *are* the cycle — no separate cycle entity is constructed). If one day is carved, Attune shows one day; if five days are carved, Attune shows five days. (UI label is "Attune Movements"; the underlying technical concept and code identifiers remain "exercises" and "attunement" for consistency with the existing exercise library and the express path's vocabulary.)
- **Mid-cycle re-attune is allowed** (deferred → resolved): the page is reachable any time during an active cycle. Days with `completedAt` set (where any set was logged) are visually dimmed with a small lock badge and are **read-only** for chip operations — no add, copy, replace, delete, or drag-in/out. Future and arrived-but-unworked days are fully editable.
- **Picker auto-closes after confirmation** (deferred → resolved). To add a second exercise to the same day, the user re-taps the day. Rationale: the multi-day target selector already covers the "spread one exercise" case; auto-close keeps the modal lifecycle simple.
- **Zoom-out chip rendering tiers** (deferred → resolved):
  - **Max zoom-out** (whole cycle visible): day cell shows the muscle kanji (already familiar from CARVE) plus a numeric chip-count badge. No chip text.
  - **Mid zoom**: day cell shows the first 2–3 chips truncated, with a `+N more` overflow indicator.
  - **Max zoom-in**: full chip stack with full exercise names, drag handles visible.

## Open Questions

### Resolved During Planning

- **Where does the Attune entry point live?** → Single button "Attune Movements" on the schedule page, overlaid on top of the month-kanji watermark, gated by day selection (CARVE-button parity). The carved/selected days *are* the cycle — Attune renders exactly those days. (See Key Technical Decisions.)
- **Mid-cycle re-attunement?** → Allowed; completed days are read-only and visually distinct. (See Key Technical Decisions.)
- **Picker stays open vs closes after selection?** → Auto-closes. Re-tap day to add another. (See Key Technical Decisions.)
- **Zoom-out chip rendering?** → Three-tier rendering driven by zoom level. (See Key Technical Decisions.)
- **Drag-and-drop library?** → `@dnd-kit/core`. (See Key Technical Decisions.)
- **Pan/zoom library?** → `react-zoom-pan-pinch`. (See Key Technical Decisions.)

### Deferred to Implementation

- Exact route path within the Next.js app (matches GTL's existing routing convention; implementer mirrors `carve` route).
- Exact persistence layer call sites — depends on whether GTL uses Zustand, React Query, Dexie/IndexedDB for offline, or a Supabase-style remote store. Implementer mirrors the CARVE screen's pattern.
- Bottom-sheet animation choreography — match the existing P5/Gurren motion vocabulary. If a bottom-sheet primitive does not exist, build a minimal one using Framer Motion or whatever the GTL animation stack already uses.
- Whether the multi-day target selector should preview its targets visually on the calendar while the picker is open (highlighting target days) — nice-to-have visual polish, decide during build.
- Whether locked completed-day chips should still show on tap (read-only inspect modal) or simply not respond — minor UX call.

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```
┌────────────────────────────────────────────────────────────┐
│  AttuneExercisesPage                                       │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  <ZoomPanSurface>  (react-zoom-pan-pinch)            │  │
│  │  panning.disabled = isChipDragging                   │  │
│  │  ┌────────────────────────────────────────────────┐  │  │
│  │  │ <CycleCalendar>  (CSS grid of DayCell)         │  │  │
│  │  │  for each day in cycle:                        │  │  │
│  │  │    <DayCell day, zoomLevel, isLocked>          │  │  │
│  │  │      kanji + chip-stack (zoom-tiered render)   │  │  │
│  │  │      onTap → openPicker(day)                   │  │  │
│  │  │      <Droppable id=day.id>                     │  │  │
│  │  │      <SortableContext> for SetChip[]           │  │  │
│  │  │        <SetChip draggable, longPressMenu>      │  │  │
│  │  └────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                            │
│  <PickerSheet open={pickerDay != null}>                    │
│    [search input]  [muscle-locked exercise list]           │
│    [multi-day target chips: source-day + others toggleable]│
│    [Confirm] → places one chip per selected day            │
│                                                            │
│  <ChipActionMenu>  (long-press / chip-tap)                 │
│    Copy | Delete | Replace                                 │
│      Replace → picker → cascade-scope modal (3 options)    │
│                                                            │
│  <DropPromptModal>                                         │
│    rest-day → "Convert this rest day to [muscle] day?"     │
│    cross-muscle → "Add [muscle] to this day's training?"   │
│                                                            │
│  <ExitGuard onLeave with N empty workout days>             │
└────────────────────────────────────────────────────────────┘

Data flow:
  cycleStore (existing)
    ↓ reads cycle + muscle assignments
  attunementStore (new): chips per (cycleId, dayId)
    ↑ writes from picker, copy, delete, replace, drag-drop
  workoutScreen (existing) reads attunementStore at workout time
    ↓ falls back to in-the-moment picker if day has 0 chips (R17)
```

## Implementation Units

- [ ] **Unit 1: Calendar surface + attunement state model**

**Goal:** Stand up the Attune Exercises page shell — full-cycle zoomable calendar with day cells rendering muscle kanji from existing cycle data — and define the attunement state shape that all subsequent units write to.

**Requirements:** R2, R3, R10 (empty default)

**Dependencies:** None (read-only against existing cycle/CARVE store).

**Files:**
- Create: `src/app/attune/page.tsx` (or matching GTL routing convention — exact path follows whatever pattern the schedule page uses; cycle ID parameterization only if GTL's data layer treats the carved days as a persisted entity)
- Create: `src/components/attune/CycleCalendar.tsx`
- Create: `src/components/attune/DayCell.tsx`
- Create: `src/state/attunement.ts` (Zustand slice or matching GTL state pattern) — defines `SetChip`, `DayAttunement`, store actions stubbed
- Test: `src/components/attune/__tests__/CycleCalendar.test.tsx`

**Approach:**
- Wrap the calendar grid in `<TransformWrapper>` from `react-zoom-pan-pinch`. Fit-to-viewport on mount so all cycle days fit at min zoom.
- Day cells are a CSS grid keyed by cycle day index. Cell dimensions are constant in cycle-coordinate space; zoom transforms the wrapper.
- Define `attunementStore` with the cycle attunement shape: `Record<DayId, { chips: SetChip[] }>`. Selectors for `chipsForDay(dayId)` and `emptyDayCount(cycleId)`.
- Mobile-first: viewport ≤ 390px. Desktop is not a target.

**Patterns to follow:**
- CARVE screen for the muscle-day visual idiom.
- Summary blade page for full-screen gestural canvases and any existing `react-zoom-pan-pinch` usage.

**Test scenarios:**
- Happy path: rendering a 14-day cycle shows 14 day cells, each labeled with the assigned muscle's kanji.
- Happy path: pinch-zooming the calendar scales day cells without re-laying-out the page header.
- Edge case: a cycle with 0 attuned chips renders all day cells in the empty visual state.
- Edge case: a cycle with mixed rest days and workout days renders rest days in the rest-day visual state and workout days with kanji.
- Integration: the calendar reads from the same cycle store CARVE writes to — modifying CARVE assignments and re-rendering Attune reflects the new muscles.

**Verification:**
- The Attune page route loads on mobile viewport and displays the user's full cycle.
- Pinch and pan gestures work on touch devices without conflicting with iOS scroll.
- The attunement store exposes the shape later units depend on (manual call from a dev tool or test).

---

- [ ] **Unit 2: Day cell tiered rendering + completed-day lock**

**Goal:** Render the chip stack inside each day cell with zoom-level-aware density (kanji + count at far zoom; truncated stack at mid; full at near). Render completed days dimmed with a lock badge and disable interactions on them.

**Requirements:** R9 (capacity), R10a (placement order), mid-cycle re-attunement decision (completed-day lock)

**Dependencies:** Unit 1.

**Files:**
- Modify: `src/components/attune/DayCell.tsx`
- Create: `src/components/attune/SetChip.tsx`
- Create: `src/lib/zoomTier.ts` (pure helper: `zoomLevel → 'far' | 'mid' | 'near'`)
- Test: `src/components/attune/__tests__/DayCell.test.tsx`
- Test: `src/lib/__tests__/zoomTier.test.ts`

**Approach:**
- `DayCell` subscribes to `attunementStore.chipsForDay(dayId)` and current zoom level (provided by `<TransformWrapper>`'s context or a parent prop drilled from the wrapper).
- Three render branches via `zoomTier`: `far` → kanji + count badge; `mid` → first 2 chips truncated + `+N more`; `near` → full sortable chip stack.
- Locked days (`completedAt != null`) render the same tiered content but with reduced opacity, a lock badge in the corner, and `pointer-events: none` on the chip stack. The cell itself remains tappable only to show a passive read-only inspect view (deferred to implementation per Open Questions).

**Patterns to follow:**
- Existing reduced-state visuals from the summary blade or the CARVE completed-day treatment, if either exists.

**Test scenarios:**
- Happy path: at far zoom, a day with 5 chips shows the muscle kanji and badge "5".
- Happy path: at mid zoom, a day with 5 chips shows the first 2 chips and `+3 more`.
- Happy path: at near zoom, a day with 5 chips shows all 5 chips full-width with drag handles.
- Edge case: a day with 0 chips at any zoom shows the empty state (kanji only, no count badge).
- Edge case: a completed day shows the lock badge and dimmed opacity at every zoom tier; tapping it does not open the picker.
- Edge case: zoom level transitions across tier boundaries re-render the cell correctly without flicker.

**Verification:**
- Pinching from min to max zoom shows three visually distinct rendering tiers.
- Completed days are visually distinct and unresponsive to chip-edit gestures.

---

- [ ] **Unit 3: Picker bottom sheet with multi-day target selector**

**Goal:** Build the search-driven picker that opens when a non-locked workout day is tapped. Picker is muscle-locked. After selecting an exercise, the user can optionally pick additional target days; on Confirm, one set chip is placed per selected day.

**Requirements:** R4, R5, R6, R7, R8, R17, R18

**Dependencies:** Unit 1 (page + store), Unit 2 (cell tap handler).

**Files:**
- Create: `src/components/attune/PickerSheet.tsx`
- Create: `src/components/attune/MultiDayTargetSelector.tsx`
- Create: `src/lib/exerciseLibrary.ts` (assumed query API — implementer wires to actual library source)
- Test: `src/components/attune/__tests__/PickerSheet.test.tsx`

**Approach:**
- `PickerSheet` is a bottom-sheet modal (Framer Motion animated or matching GTL motion vocab).
- Header: search input following the iOS PWA keyboard recipe (`inputMode`, `enterKeyHint`, parent form `action`+`method`, etc. — see institutional learnings).
- Body: scrollable list of exercises filtered by `dayMuscle` query against `exerciseLibrary`.
- Above the body, a horizontal scrolling row of `MultiDayTargetSelector` chips representing every day in the visible calendar that matches the source day's muscle. Source day pre-selected and non-removable. User toggles others to add them.
- On exercise tap → exercise becomes "selected" (highlighted) but does not commit. A `Confirm` button at the bottom commits: one set chip per selected day.
- After confirm → picker auto-closes.

**Patterns to follow:**
- iOS PWA keyboard recipe (institutional learning) — ensure search input summons the keyboard reliably.
- Existing GTL bottom-sheet patterns (modal stacks elsewhere in the app).

**Test scenarios:**
- Happy path: tap a chest day → picker opens muscle-locked to chest exercises only.
- Happy path: select bench press, leave only source day selected, Confirm → exactly one bench-press chip on the source day.
- Happy path: select bench press, also toggle 4 additional chest days → exactly one bench-press chip per selected day after Confirm (5 total writes).
- Edge case: search input filters exercise list as the user types; clearing the search restores the full muscle-filtered list.
- Edge case: the source day cannot be deselected from the multi-day selector.
- Edge case: a leg day cannot appear in the multi-day selector when the source is a chest day (muscle-lock parity).
- Error path: closing the picker without confirming makes no writes to the store.
- Integration: arriving at an empty workout day from outside Attune (R17) opens the same picker component scoped to today's muscle, with no multi-day selector (single-day mode).

**Verification:**
- iOS PWA: tapping the search field summons the soft keyboard.
- Multi-day attunement of a single exercise across all chest days completes in one Confirm tap.

---

- [ ] **Unit 4: Set chip actions — Copy, Delete, Replace + cascade scope modal**

**Goal:** Long-press (or context-menu icon, per GTL convention) on a chip exposes Copy, Delete, Replace. Replace triggers the picker and then a 3-way cascade scope modal. Copy duplicates the chip in place. Delete removes a single chip.

**Requirements:** R11, R11a, R12

**Dependencies:** Unit 2 (chip rendering), Unit 3 (picker — Replace reuses it).

**Files:**
- Create: `src/components/attune/ChipActionMenu.tsx`
- Create: `src/components/attune/ReplaceCascadeModal.tsx`
- Modify: `src/components/attune/SetChip.tsx` (long-press handler)
- Modify: `src/state/attunement.ts` (actions: `duplicateChip`, `deleteChip`, `replaceExercise`)
- Test: `src/components/attune/__tests__/ChipActionMenu.test.tsx`
- Test: `src/state/__tests__/attunement.test.ts`

**Approach:**
- `ChipActionMenu` is a small floating menu anchored to the chip on long-press / icon-tap.
- **Copy**: `duplicateChip(dayId, chipId)` inserts a new chip with a fresh UUID immediately after the source in the day's chip array, same `exerciseId`.
- **Delete**: `deleteChip(dayId, chipId)`.
- **Replace**: opens `PickerSheet` in single-target Replace mode (no multi-day selector visible). After exercise selection, opens `ReplaceCascadeModal` with three buttons:
  - "Just this chip"
  - "All [exercise] sets on this day"
  - "All [exercise] sets in this cycle"
- Each maps to `replaceExercise(scope, ...)`.

**Patterns to follow:**
- Existing context-menu / action-sheet pattern in GTL.

**Test scenarios:**
- Happy path: Copy on a bench-press chip on a day with [bench, flys] produces [bench, bench, flys].
- Happy path: Delete on the second of three bench chips on a day produces [bench, bench] (other two untouched).
- Happy path: Replace bench → incline with scope "just this chip" only changes the tapped chip's exerciseId.
- Happy path: Replace bench → incline with scope "all on this day" changes every bench chip on this day to incline; other days unaffected.
- Happy path: Replace bench → incline with scope "all in cycle" changes every bench chip on every day to incline.
- Edge case: Replace on a day where only one bench chip exists, scope "all on this day" → behaves identically to "just this chip".
- Edge case: Copy on a chip in a day at chip-count = 0 should not occur (chips don't exist) — UI prevents this.
- Error path: Replace on a chip whose new exercise targets a different muscle is rejected at the picker level (muscle-lock).
- Integration: Replace cascade actions are atomic — a partial failure leaves the store unchanged (transaction-like or use a single store update).

**Verification:**
- All three Replace cascade scopes produce visibly correct chip diffs across the full calendar.
- Copy keeps insertion order; the duplicate sits immediately below the source.

---

- [ ] **Unit 5: Drag-and-drop with rest-day and cross-muscle prompts**

**Goal:** Set chips drag from one day's cell to another. Drop on a rest day or cross-muscle workout day prompts the user; matching-muscle drops are silent. Drag is a move (chip leaves source).

**Requirements:** R13, R14, R15, R16

**Dependencies:** Unit 1 (page), Unit 2 (chip rendering).

**Files:**
- Create: `src/components/attune/DragContext.tsx` (wraps `<DndContext>` from `@dnd-kit`)
- Create: `src/components/attune/DropPromptModal.tsx`
- Modify: `src/components/attune/DayCell.tsx` (becomes a `useDroppable` target)
- Modify: `src/components/attune/SetChip.tsx` (becomes `useDraggable`)
- Modify: `src/components/attune/CycleCalendar.tsx` (disables zoom-pan during chip drag)
- Modify: `src/state/attunement.ts` (action: `moveChip(fromDay, chipId, toDay)`, `convertRestDay(dayId, muscle)`, `addMuscleToDay(dayId, muscle)`)
- Test: `src/components/attune/__tests__/DragDrop.test.tsx`

**Approach:**
- Wrap the calendar in a `<DndContext>` with a `PointerSensor` configured `activationConstraint: { distance: 8 }` so a tap-without-drag still routes to the picker.
- On drag start: set `attunementStore.isChipDragging = true` → `<TransformWrapper>` reads this and disables panning.
- On drop, derive the destination day. Compute drop kind:
  - Source and destination day have matching muscle for the chip's exercise → silent move.
  - Destination is a rest day → open `DropPromptModal` (variant: "Convert rest day"). Confirm → `convertRestDay(destDayId, exerciseMuscle)` then `moveChip`. Cancel → no-op.
  - Destination is a workout day with a different muscle → open `DropPromptModal` (variant: "Add muscle"). Confirm → `addMuscleToDay(destDayId, exerciseMuscle)` then `moveChip`. Cancel → no-op.
- All drops are moves; never copies. Copy lives in the chip action menu (Unit 4).

**Patterns to follow:**
- @dnd-kit standard `<DndContext>` + `useDraggable` / `useDroppable` patterns.
- Existing modal/dialog primitives in GTL for `DropPromptModal`.

**Test scenarios:**
- Happy path: drag a bench-press chip from chest Day 3 to chest Day 7 → silently appended to Day 7, removed from Day 3.
- Happy path: drag bench-press chip onto a rest day → confirm prompt, accept → rest day becomes chest day, chip lands.
- Happy path: drag bench-press chip onto an arms-only day → confirm prompt, accept → day muscles become [arms, chest], chip lands.
- Happy path: cancelling the rest-day prompt leaves both source and destination unchanged.
- Happy path: cancelling the cross-muscle prompt leaves both source and destination unchanged.
- Edge case: a tap shorter than the 8px activation distance opens the picker, not a drag.
- Edge case: dragging within the same day cell (re-ordering) is a no-op (Attune is placement-only per R10a).
- Edge case: dragging onto the source day itself is a no-op.
- Edge case: dragging while pan-zoom is mid-gesture is rejected (only one gesture wins).
- Error path: dropping onto a locked completed day is rejected with a small toast or shake — chip returns to source.
- Integration: after a drag-drop with prompt, the calendar re-renders both source and destination cells with correct chip stacks and (for rest-day conversion) updated muscle assignments.

**Verification:**
- Touch drag works smoothly on iOS and Android Chrome at all zoom levels.
- Pan-zoom is suspended for the duration of a chip drag and restored after drop or cancel.

---

- [ ] **Unit 6: Schedule-page entry, onboarding popup, Auto-attune all, exit confirmation**

**Goal:** Wire up the page's connecting tissue — the "Attune Movements" entry button on the schedule page (with the month-kanji watermark treatment and day-selection gating), the first-time-user instruction popup, the prominent "Auto-attune all" button on first open of the Attune page, and the exit-confirmation dialog when leaving with empty workout days.

**Requirements:** R1, R10, R19, R20

**Dependencies:** Units 1–5.

**Files:**
- Create: `src/components/attune/AutoAttuneButton.tsx`
- Create: `src/components/attune/ExitGuardDialog.tsx`
- Create: `src/components/attune/FirstTimeInstructionPopup.tsx` (one-shot onboarding modal, persistence-flag gated)
- Create: `src/components/schedule/AttuneMovementsButton.tsx` (the schedule-page entry button, day-gated like CARVE)
- Modify: existing schedule page component (demote month kanji to watermark; mount `AttuneMovementsButton` overlaid on top; ensure day-selection state is shared with both CARVE button and the new button)
- Modify: `src/app/attune/page.tsx` (mounts the auto-attune button + exit guard)
- Modify: `src/state/attunement.ts` (action: `autoAttuneAll(cycleId)`)
- Test: `src/components/attune/__tests__/AutoAttuneButton.test.tsx`
- Test: `src/components/attune/__tests__/ExitGuard.test.tsx`
- Test: `src/components/attune/__tests__/FirstTimeInstructionPopup.test.tsx`
- Test: `src/components/schedule/__tests__/AttuneMovementsButton.test.tsx`

**Approach:**
- **Schedule page entry button**: The schedule page's existing month-kanji label is restyled as a low-opacity background watermark (positioned absolutely, behind interactive content, no pointer events). `AttuneMovementsButton` is rendered overlaid in front of the watermark. The button reads the schedule page's existing `selectedDays` state; while no days are selected it is visually inactive and non-interactive (matching the CARVE button's existing inactive treatment); once at least one day is selected, both CARVE and Attune Movements buttons become active. Tapping Attune Movements opens the Attune page, which renders exactly the currently-selected (carved) days.
- **AutoAttuneButton** is rendered prominently on the Attune page while the cycle has zero attuned chips. After first attunement (any chip exists anywhere), it dismisses or moves to a less prominent location. Pressing it calls `autoAttuneAll()` which writes one canonical exercise per muscle-day across the carved days. Auto-attune logic is shared with the express path's auto-pick if such a function already exists; otherwise the implementer writes a thin selector (one canonical exercise per muscle, deterministic).
- **FirstTimeInstructionPopup**: On Attune page mount, the component checks a persistent flag (`attuneOnboardingSeen` in local storage / GTL's preferences store, mirroring whatever pattern other onboarding hints use). If the flag is unset, the popup renders modally with the copy (verbatim, lowercase): *"attune your movements to specific days. copy, move, and replace movements at will."* Dismissing the popup sets the flag and never shows again — across all future cycles, all future visits, on this user's device. The popup must not block other Attune page initialization; it sits as an overlay the user dismisses to reach the page.
- **No cycle ID parameterization needed**: The Attune page reads from the same carved-days source-of-truth as the schedule page. If GTL's existing data layer represents the carved days as a persisted entity with an ID, the route can use it; if the carved days are simply the current schedule state, the Attune page reads that state directly. Implementer mirrors whatever pattern the schedule page uses to read its own state.
- **Day-selection gating exactly mirrors CARVE** (no muscle prerequisite): Attune Movements activates the moment any day is selected, even if no muscles have been assigned yet. A day with no muscles assigned will surface an empty state inside the Attune page (the picker can't open because there's no muscle to lock to) — letting users discover the gap in context rather than blocking the entry button on it.
- **First-time-user instruction popup** (R20): Globally one-shot, not per-cycle. Persisted via a single boolean flag (e.g., `attuneOnboardingSeen` in local storage / GTL's existing preferences store). Copy (verbatim, lowercase as written): *"attune your movements to specific days. copy, move, and replace movements at will."* Shown on the user's first-ever entry to the Attune Movements page. Dismissing flips the flag; subsequent entries (any cycle, any time) do not show it again.
- **ExitGuardDialog** intercepts back navigation (browser back, header back button, route changes within the SPA). On intercept, if `attunementStore.emptyDayCount() > 0` (counting only carved workout days that have zero chips), show the dialog: "You have N workout day(s) with no exercises attuned. Are you sure you want to leave?" Confirm → proceed; Cancel → stay on page.

**Patterns to follow:**
- The existing CARVE button on the schedule page — the new Attune Movements button must mirror its size, day-gated activation, disabled visual state, and selection-state subscription.
- Existing GTL navigation guard pattern, if any. Otherwise a Next.js `useRouter` `beforeunload` + custom history-listener combo.
- Existing dialog primitives.

**Test scenarios:**
- Happy path: on the schedule page with no days selected, the Attune Movements button is visible but non-interactive; the month kanji is rendered as a watermark behind it.
- Happy path: selecting a day activates both the CARVE button and the Attune Movements button simultaneously.
- Happy path: tapping Attune Movements with one day selected opens the Attune page rendering exactly one day.
- Happy path: tapping Attune Movements with five days selected opens the Attune page rendering exactly five days.
- Happy path: tapping Auto-attune all on a cycle with 0 chips populates every workout day with one chip, makes the button dismiss, and re-renders the calendar.
- Happy path: leaving Attune with no empty workout days navigates away without prompting.
- Happy path: leaving Attune with 3 empty workout days shows the dialog with count "3"; cancel → still on page; confirm → navigates away.
- Edge case: deselecting all days on the schedule page returns the Attune Movements button to its inactive state.
- Edge case: a cycle of all rest days (no workout days carved) → exit guard does not prompt (empty count is 0).
- Edge case: a cycle where the user converted a rest day to a workout day via drag-drop (R14) but it ended up with 0 chips after a Delete — the converted-then-emptied day counts toward the empty count.
- Edge case: Auto-attune all on a cycle that already has some chips: confirm-prompt before overwriting existing attunements (or only fill empty days — implementer decision noted in deferred).
- Integration: the exit guard catches all navigation paths, not just one (browser back, header back, route push).
- Integration: month-kanji watermark and Attune Movements button do not visually clash with the CARVE button or other schedule-page chrome at the mobile viewport (~390×844).
- Integration: the Attune page reads the same carved-days state the schedule page wrote, so adding/removing days on the schedule and re-entering Attune reflects the change.
- Happy path: a user's first-ever entry to the Attune page shows the FirstTimeInstructionPopup with the documented copy.
- Happy path: dismissing the popup sets the persistent flag and the popup does not reappear on a second entry.
- Edge case: the popup persists its flag across full page reloads and across sessions (localStorage / equivalent persistence layer).
- Edge case: a user who has already dismissed the popup, then enters Attune via a brand-new cycle, does not see the popup again (the flag is global, not per-cycle).

**Verification:**
- The schedule-page entry reaches Attune with day context preserved.
- Day-selection gating matches the CARVE button's behavior (visually and interactively).
- The exit guard fires reliably across navigation paths.
- Auto-attune produces a usable cycle in a single tap.

## System-Wide Impact

- **Interaction graph:** Attune writes to a new `attunementStore`, but the workout screen (existing) must read from it at workout time. The Log Set redesign (separate effort) needs to consume `chipsForDay(today)` and treat zero chips as the trigger for the in-the-moment picker (R17). This is a contract this plan creates and the workout screen must honor — call out in the workout screen redesign plan.
- **Error propagation:** Picker-driven writes, drag-drops, and cascade replaces all mutate the store. Each mutation is a single store action with no partial state — failures (e.g., the cascade replace touching N chips) must be atomic. Use a single store update or wrap in a transaction-like pattern.
- **State lifecycle risks:** Mid-cycle re-attune introduces a risk of editing chips on days the user has already started but not completed. The "completed" lock fires only on `completedAt` (set logged); arrived-but-empty days remain editable. Validate that arrival-without-logging does not accidentally lock the day.
- **API surface parity:** The CARVE store and the new attunement store are separate but coupled — converting a rest day via drop (R14) writes to *both* stores (CARVE: muscles array, attunement: chips). Ensure CARVE listeners and Attune listeners both re-render in response to a single user action.
- **Integration coverage:** Drag-drop + zoom-pan composition is the main integration risk. Touch on a chip should drag; touch on empty calendar space should pan; touch on a chip that crosses the activation distance should commit to drag. Cover with on-device testing.
- **Unchanged invariants:** Express forge cycle path unchanged. CARVE muscle assignment behavior unchanged for non-rest-day-conversion paths. Workout screen behavior unchanged except for reading from the new attunement store.

## Risks & Dependencies

| Risk | Mitigation |
|---|---|
| Drag-drop competes with pan-zoom on touch | Activation distance + `panning.disabled` toggled by `isChipDragging`. Test on real iOS and Android devices early in Unit 5. |
| Cascade replace edits N chips and partially fails | Single atomic store update; never iterate-and-write across awaits. |
| Mid-cycle re-attune corrupts a workout-in-progress | Lock days with `completedAt`. Verify `completedAt` is only set when at least one set is logged, not on day arrival. |
| Auto-attune produces nonsense pairings | Use the same canonical-exercise mapping as the express path's auto-pick (if it exists). If it doesn't yet, defer Auto-attune polish until the curated library is taggable. |
| iOS PWA keyboard fails to summon in picker search | Apply the documented iOS PWA keyboard recipe (institutional learning). Verify on a real iPhone in PWA standalone mode. |
| Coordinate translation between zoom-pan and drop targets misaligns | Trust @dnd-kit's screen-space collision detection. Avoid manual math. |
| Multi-day target selector misleads at non-max zoom (target days off-screen) | Either auto-pan to show all targets, or show the count textually with a "see selection" preview. Decide during build. |

## Documentation / Operational Notes

- This page does not require new docs but warrants a 1-paragraph entry in the GTL feature list and a screen-record demo for the Attune flow + drag-drop.
- No migrations: the attunement store is new and starts empty.
- No feature flag needed — the planned-cycle path is an additive surface; the express path is unchanged. Ship Attune and the CARVE-confirmation entry point together.

## Sources & References

- **Origin document:** `docs/brainstorms/2026-05-02-gtl-exercise-selection-requirements.md`
- Related code (in target repo): the CARVE screen, the express forge cycle path, the workout / log set screen.
- External docs:
  - `@dnd-kit/core` — https://docs.dndkit.com
  - `react-zoom-pan-pinch` — https://github.com/BetterTyped/react-zoom-pan-pinch
