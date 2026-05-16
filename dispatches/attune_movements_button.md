# Attune Movements button on schedule page — Worker B (GTL 2)

**Target:** GTL 2 (`/c/Users/Jordan/gtl-2/` on `gtl2`). Branch: `dev`. Dev server: http://localhost:3002.

**Source-of-truth docs (read first; both live alongside this spec):**
- Plan: `dispatches/2026-05-02-001-feat-attune-exercises-page-plan.md` (Unit 6 schedule-page-button parts)
- Brainstorm: `dispatches/2026-05-02-gtl-exercise-selection-requirements.md` (R1)

You own the **entry point button** on the existing schedule page. Worker A on GTL 1 is building the destination page (`/attune` route). Worker C on GTL 3 is modifying the log-set screen. You don't touch either.

Auto-pull loop is running on this worker — Worker A's stub route will appear on `origin/dev` soon. You can develop in parallel; integration is just navigation.

## Scope (yours)

1. Demote the existing **month kanji** on the schedule page to a low-opacity background watermark.
2. Create `AttuneMovementsButton` — overlaid on top of the kanji watermark.
3. Day-selection-gated activation, **mirroring the existing CARVE button exactly**.
4. Tapping the button navigates to the Attune Movements page (`/attune` or whatever route Worker A lands).

## Out of scope (NOT yours)

- The Attune page itself (Worker A / GTL 1 owns).
- The CARVE button (don't touch — your button mirrors its behavior, that's it).
- Log-set / workout / active-day screens (Worker C / GTL 3 owns).
- Any state changes to muscle assignment, day selection, or carved-days source-of-truth.

## What to do

### 1. Find the schedule page and the month kanji

The schedule page is the existing screen with the calendar where days get selected and CARVE is tapped (likely `app/fitness/.../page.js` or matching GTL routing — search for the existing CARVE button component and trace upward to the parent page).

Locate where the **month kanji** is rendered — the prominent kanji label on the schedule page that indicates the current month. It's currently rendered as foreground content; you're going to push it to the background.

### 2. Demote the kanji to a watermark

Restyle the month-kanji element so it:
- Sits behind interactive content (`z-index` lower than buttons; `position: absolute` if needed)
- Has low opacity (target `0.10`–`0.15` — adjust visually)
- Has `pointer-events: none` so taps pass through it
- Is large and centered behind the button area (visually a watermark, not a label)

Don't delete the kanji — just push it back. It still indicates the month; it's now atmospheric rather than functional.

### 3. Create AttuneMovementsButton

**Create:** `src/components/schedule/AttuneMovementsButton.tsx` (or matching GTL component-folder convention).

The button:
- Visual treatment **mirrors the existing CARVE button** — same size, same family of colors (P5/Gurren palette), same disabled/enabled states. Read the existing `SheetCarveButton` (or whatever the CARVE button is named) and use it as the visual template.
- Label: **"ATTUNE MOVEMENTS"** (uppercase, matching CARVE's casing).
- Activation: subscribes to the same day-selection state the CARVE button reads. Inactive (visually dimmed, non-interactive) when no days are selected. Active the moment any day is selected — **same gating as CARVE button, no muscle prerequisite**. The user discovers the empty state inside the Attune page if they entered without muscles assigned.
- On tap: navigate to `/attune` (or whatever route Worker A lands — `git pull origin dev` and check Worker A's first commit for the actual route path).

### 4. Place the button on the schedule page

Insert `AttuneMovementsButton` in front of the kanji watermark. It sits visually overlaid on the watermark.

Placement: somewhere logical relative to the existing CARVE button. Likely both buttons coexist on the schedule page — CARVE for muscle assignment, Attune Movements as a secondary action. Stack vertically, side-by-side, or whatever layout fits the existing design vocabulary. Don't push CARVE around; add Attune in a way that respects the existing layout.

### 5. Verify navigation reaches Attune page

After Worker A pushes the page route, pulling `origin/dev` will land it. Tap your button → routes to Attune page. If Worker A's page hasn't pushed yet, tap should still attempt the route (404 is fine for now; navigation glue must be correct).

## DO NOT

- Touch the existing CARVE button visually or behaviorally.
- Touch the muscle grid, calendar grid, day-selection logic, or any state writers.
- Delete the month kanji — only restyle it.
- Build any of the Attune page itself — that's Worker A.
- Touch the log-set / workout screen — that's Worker C.
- Add a muscle-prerequisite to the activation gating — match CARVE exactly (any day selected → both buttons activate).

## Verify

Mobile viewport (~390×844):

1. Reload schedule page with no days selected. Confirm:
   - Month kanji is visible but watermarked (low-opacity background).
   - Both CARVE button and Attune Movements button are visible but inactive (dimmed, same dimming style as CARVE).
2. Select a day. Confirm both CARVE and Attune Movements activate simultaneously (matching gold/active treatment).
3. Tap Attune Movements. Confirm navigation reaches `/attune` (Worker A's page, even if stubbed).
4. Deselect all days. Confirm both buttons return to inactive state.
5. Visual check: Attune Movements button does not visually clash with CARVE or the watermark at iPhone size.

## Report

- Commit hash on `origin/dev`.
- Three screenshots: (a) schedule page no days selected — watermark + both buttons inactive, (b) one day selected — both buttons active, (c) navigated to Attune (whatever stub or real page exists at the moment).

## Commit and push

Commit message: `Schedule: month kanji watermark + Attune Movements button (CARVE-gated entry to Attune page)`

Push to `origin/dev` when done.
